/// <reference types="jest" />
import * as os from 'os';
import * as path from 'path';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import {
  parseEntries,
  convertCacheFormatToEntries,
  getCacheConfig,
  resolvePath,
  validateInputs,
  getPlatformSuffix,
} from '../lib/utils';
import { run as restoreRun } from '../lib/restore';
import { mockGetInput, mockGetBooleanInput } from './setup';

describe('Additional Coverage - Ready for Production Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.BORINGCACHE_API_TOKEN;
    delete process.env.BORINGCACHE_DEFAULT_WORKSPACE;
    (exec.exec as unknown as jest.Mock).mockImplementation((cmd, args, opts) => {
      if (cmd === 'boringcache' && args?.[0] === '--version') {
        if (opts?.listeners?.stdout) {
          opts.listeners.stdout(Buffer.from('boringcache 1.0.0'));
        }
        return Promise.resolve(0);
      }
      return Promise.resolve(0);
    });
  });

  describe('parseEntries - error handling & extended syntax', () => {
    it('throws for missing ":" separator', () => {
      expect(() => parseEntries('invalid-entry-without-colon', 'restore')).toThrow(
        /Invalid entry format: .* Expected format: tag:path or tag:restore_path=>save_path/
      );
    });

    it('throws when using "=>" without both restore and save', () => {
      expect(() => parseEntries('key:/tmp/only-restore=>', 'restore')).toThrow(
        /Invalid entry format: .* Expected restore and save paths when using => syntax/
      );
      expect(() => parseEntries('key:=>/tmp/only-save', 'restore')).toThrow(
        /Invalid entry format: .* Expected restore and save paths when using => syntax/
      );
    });

    it('supports tag:restore=>save split paths (restore mode)', () => {
      const entries = parseEntries('docker-cache:/tmp/.buildx-read=>/tmp/.buildx-write', 'restore');
      expect(entries).toEqual([
        {
          tag: 'docker-cache',
          restorePath: expect.stringContaining('/tmp/.buildx-read'),
          savePath: expect.stringContaining('/tmp/.buildx-write'),
        },
      ]);
    });

    it('supports multiple comma-separated entries', () => {
      const entries = parseEntries(
        'one:/a/path,two:/b/path=>/b/save,three:/c/path',
        'restore'
      );
      expect(entries).toHaveLength(3);
      expect(entries[0]).toMatchObject({ tag: 'one' });
      expect(entries[1]).toMatchObject({ tag: 'two' });
      expect(entries[2]).toMatchObject({ tag: 'three' });
    });
  });

  describe('resolvePath - absolute/tilde/relative handling', () => {
    it('returns absolute path if already absolute', () => {
      const abs = path.resolve('/tmp/cache');
      expect(resolvePath(abs)).toBe(abs);
    });

    it('expands tilde to home', () => {
      const home = os.homedir();
      const p = resolvePath('~/cache-dir');
      expect(p).toBe(path.join(home, 'cache-dir'));
    });

    it('resolves relative path against cwd', () => {
      const p = resolvePath('relative/dir');
      expect(p).toBe(path.resolve(process.cwd(), 'relative/dir'));
    });
  });

  describe('convertCacheFormatToEntries - actions/cache compatibility', () => {
    beforeEach(() => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';
    });

    it('produces tag:path with platform suffix by default', () => {
      const entries = convertCacheFormatToEntries(
        { path: './build', key: 'key-123', enableCrossOsArchive: false },
        'save'
      );
      const suffix = getPlatformSuffix(false, false);
      expect(entries).toContain(`key-123${suffix}:`);
      expect(entries).toMatch(/:.*build/);
    });

    it('disables platform suffix with enableCrossOsArchive', () => {
      const entries = convertCacheFormatToEntries(
        { path: './build', key: 'key-123', enableCrossOsArchive: true },
        'save'
      );
      expect(entries).toContain('key-123:');
      const linuxOrDarwinSuffix = /-(darwin|linux)-(arm64|amd64)/;
      expect(entries).not.toMatch(linuxOrDarwinSuffix);
    });

    it('disables platform suffix with noPlatform (legacy flag)', () => {
      const entries = convertCacheFormatToEntries(
        { path: './build', key: 'key-123', enableCrossOsArchive: false, noPlatform: true },
        'save'
      );
      expect(entries).toContain('key-123:');
      const linuxOrDarwinSuffix = /-(darwin|linux)-(arm64|amd64)/;
      expect(entries).not.toMatch(linuxOrDarwinSuffix);
    });
  });

  describe('getCacheConfig - key + platform suffix resolution', () => {
    beforeEach(() => {
      delete process.env.BORINGCACHE_DEFAULT_WORKSPACE;
      delete process.env.GITHUB_REPOSITORY;
    });

    it('appends platform suffix by default', async () => {
      const cfg = await getCacheConfig('deps-abc', false, false);
      const expectedSuffix = getPlatformSuffix(false, false);
      expect(cfg.fullKey).toBe(`deps-abc${expectedSuffix}`);
      expect(typeof cfg.workspace).toBe('string');
    });

    it('can be suffixless when requested', async () => {
      const cfg = await getCacheConfig('deps-abc', true, true);
      expect(cfg.fullKey).toBe('deps-abc');
    });

    it('uses BORINGCACHE_DEFAULT_WORKSPACE when provided', async () => {
      process.env.BORINGCACHE_DEFAULT_WORKSPACE = 'custom/ns';
      const cfg = await getCacheConfig('deps-abc', false, false);
      expect(cfg.workspace).toBe('custom/ns');
    });

    it('falls back to GITHUB_REPOSITORY owner/repo', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      const cfg = await getCacheConfig('deps-abc', false, false);
      expect(cfg.workspace).toBe('owner/repo');
    });

    it('normalizes workspace without namespace', async () => {
      process.env.BORINGCACHE_DEFAULT_WORKSPACE = 'solo';
      const cfg = await getCacheConfig('deps-abc', false, false);
      expect(cfg.workspace).toBe('default/solo');
    });
  });

  describe('validateInputs - warnings and errors', () => {
    it('accepts CLI format (workspace + entries)', () => {
      expect(() =>
        validateInputs({ workspace: 'ns/ws', entries: 'tag:/path' })
      ).not.toThrow();
    });

    it('accepts actions/cache format (path + key)', () => {
      expect(() =>
        validateInputs({ path: '~/.cache', key: 'k1' })
      ).not.toThrow();
    });

    it('warns when both formats provided (uses CLI format)', () => {
      const warnSpy = jest.spyOn(core, 'warning').mockImplementation(() => {});
      validateInputs({
        workspace: 'ns/ws',
        entries: 'tag:/path',
        path: '~/.cache',
        key: 'k1',
      });
      expect(warnSpy).toHaveBeenCalledWith(
        'Both CLI format (workspace/entries) and actions/cache format (path/key) provided. Using CLI format.'
      );
    });

    it('throws on invalid workspace format', () => {
      expect(() => validateInputs({ workspace: 'invalid', entries: 'tag:/p' })).toThrow(
        /Workspace must be in format "namespace\/workspace"/
      );
    });

    it('throws when neither CLI nor actions/cache inputs provided', () => {
      expect(() => validateInputs({})).toThrow(
        /Either \(workspace \+ entries\) or \(path \+ key\) inputs are required/
      );
    });
  });

  describe('restore.ts - flag pass-through verification', () => {
    beforeEach(() => {
      (exec.exec as unknown as jest.Mock).mockImplementation((cmd, args, opts) => {
        if (cmd === 'boringcache' && args?.[0] === '--version') {
          if (opts?.listeners?.stdout) {
            opts.listeners.stdout(Buffer.from('boringcache 1.0.0'));
          }
          return Promise.resolve(0);
        }
        return Promise.resolve(0);
      });
    });

    it('passes through --fail-on-cache-miss, --lookup-only, --verbose', async () => {
      mockGetInput({
        workspace: 'my-org/my-project',
        entries: 'deps:node_modules',
      });
      mockGetBooleanInput({
        'no-platform': true,
        'fail-on-cache-miss': true,
        'lookup-only': true,
        verbose: true,
      });

      await restoreRun();

      // Look for restore invocation with flags
      const calls = (exec.exec as unknown as jest.Mock).mock.calls;
      const restoreCall = calls.find(
        (c: any[]) =>
          c[0] === 'boringcache' && Array.isArray(c[1]) && c[1][0] === 'restore'
      );
      expect(restoreCall).toBeTruthy();
      const args = restoreCall[1] as string[];
      expect(args).toContain('my-org/my-project');
      expect(args).toContain('deps:node_modules');
      expect(args).toContain('--no-platform');
      expect(args).toContain('--fail-on-cache-miss');
      expect(args).toContain('--lookup-only');
      expect(args).toContain('--verbose');
    });

    it('stores save-entries derived from entries (for post save)', async () => {
      mockGetInput({
        workspace: 'ns/ws',
        entries: 'docker-cache:/tmp/read=>/tmp/write',
      });
      mockGetBooleanInput({ 'no-platform': true });

      await restoreRun();

      expect(core.saveState).toHaveBeenCalledWith(
        'cache-entries',
        'docker-cache:/tmp/write'
      );
      expect(core.saveState).toHaveBeenCalledWith(
        'cache-entries-restore',
        'docker-cache:/tmp/read'
      );
      expect(core.saveState).toHaveBeenCalledWith('cache-workspace', 'ns/ws');
    });

    it('falls back to restore-keys with platform suffix when primary key misses', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      const suffix = getPlatformSuffix(false, false);
      const execMock = exec.exec as unknown as jest.Mock;

      execMock.mockImplementation((command: string, args?: string[], opts?: any) => {
        if (command === 'boringcache' && args?.[0] === '--version') {
          if (opts?.listeners?.stdout) {
            opts.listeners.stdout(Buffer.from('boringcache 1.0.0'));
          }
          return Promise.resolve(0);
        }
        if (command === 'boringcache' && args?.[0] === 'restore') {
          const entryArg = args?.[2] ?? '';
          if (entryArg.includes(`deps-hash123${suffix}:`)) {
            return Promise.resolve(1);
          }
          expect(entryArg).toContain(`deps-v1${suffix}:`);
          return Promise.resolve(0);
        }
        return Promise.resolve(0);
      });

      mockGetInput({
        path: 'node_modules',
        key: 'deps-hash123',
        'restore-keys': 'deps-v1',
      });
      mockGetBooleanInput({});

      await restoreRun();

      expect(
        execMock.mock.calls.filter(
          (call: any[]) => call[0] === 'boringcache' && call[1][0] === 'restore'
        )
      ).toHaveLength(2);
    });

    it('fails the workflow when fail-on-cache-miss is set and no cache hits occur', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      const execMock = exec.exec as unknown as jest.Mock;

      execMock.mockImplementation((command: string, args?: string[], opts?: any) => {
        if (command === 'boringcache' && args?.[0] === '--version') {
          if (opts?.listeners?.stdout) {
            opts.listeners.stdout(Buffer.from('boringcache 1.0.0'));
          }
          return Promise.resolve(0);
        }
        if (command === 'boringcache' && args?.[0] === 'restore') {
          return Promise.resolve(1);
        }
        return Promise.resolve(0);
      });

      mockGetInput({
        path: 'node_modules',
        key: 'deps-hash123',
      });
      mockGetBooleanInput({
        'fail-on-cache-miss': true,
      });

      await restoreRun();

      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Cache restore miss')
      );
      expect(core.saveState).not.toHaveBeenCalled();
    });
  });
});

describe('Windows PATH/installer fallback - ensureBoringCache via Git Bash', () => {
  it('delegates CLI setup to action-core and runs restore', async () => {
    // Mock platform to Windows
    const os = require('os');
    jest.spyOn(os, 'platform').mockReturnValue('win32');

    const exec = require('@actions/exec');
    const { run: restoreRun } = require('../lib/restore');
    const { ensureBoringCache } = require('@boringcache/action-core');

    // Reset mocks
    jest.clearAllMocks();

    // Re-setup mocks after clearAllMocks
    const coreModule = require('@actions/core');
    ensureBoringCache.mockImplementation(async (options: any) => {
      const token = options?.token || process.env.BORINGCACHE_API_TOKEN;
      if (token) {
        coreModule.setSecret(token);
      }
    });

    const { execBoringCache } = require('@boringcache/action-core');
    execBoringCache.mockImplementation(async (args: string[], options?: any) => {
      return exec.exec('boringcache', args, options);
    });

    (exec.exec as unknown as jest.Mock).mockResolvedValue(0);

    // Provide inputs for restore
    const { mockGetInput, mockGetBooleanInput } = require('./setup');
    mockGetInput({
      workspace: 'ns/ws',
      entries: 'deps:node_modules',
    });
    mockGetBooleanInput({
      'no-platform': true,
    });

    // Run restore - CLI setup is delegated to action-core
    await restoreRun();

    // Verify ensureBoringCache was called (handles Windows-specific PATH issues)
    expect(ensureBoringCache).toHaveBeenCalled();

    // Verify restore command was called
    const calls = (exec.exec as unknown as jest.Mock).mock.calls;
    const restoreCall = calls.find(
      (c: any[]) => c[0] === 'boringcache' && Array.isArray(c[1]) && c[1][0] === 'restore'
    );
    expect(restoreCall).toBeTruthy();
  });
});
