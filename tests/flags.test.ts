/// <reference types="jest" />
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { run as restoreRun } from '../lib/restore';
import { run as saveRun } from '../lib/save';
import { run as saveOnlyRun } from '../lib/save-only';
import { run as restoreOnlyRun } from '../lib/restore-only';
import { mockGetInput, mockGetBooleanInput, mockGetState } from './setup';

describe('Flag consistency tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.BORINGCACHE_API_TOKEN;

    (exec.exec as jest.Mock).mockImplementation((cmd, args, opts) => {
      if (cmd === 'boringcache' && args?.[0] === '--version') {
        if (opts?.listeners?.stdout) {
          opts.listeners.stdout(Buffer.from('boringcache 1.0.0'));
        }
        return Promise.resolve(0);
      }
      return Promise.resolve(0);
    });
  });

  describe('restore.ts saves all flags to state', () => {
    it('saves no-platform=true to state', async () => {
      mockGetInput({ workspace: 'ns/ws', entries: 'deps:node_modules' });
      mockGetBooleanInput({ 'no-platform': true });

      await restoreRun();

      expect(core.saveState).toHaveBeenCalledWith('no-platform', 'true');
    });

    it('saves no-platform=false to state', async () => {
      mockGetInput({ workspace: 'ns/ws', entries: 'deps:node_modules' });
      mockGetBooleanInput({});

      await restoreRun();

      expect(core.saveState).toHaveBeenCalledWith('no-platform', 'false');
    });

    it('saves enableCrossOsArchive to state', async () => {
      mockGetInput({ workspace: 'ns/ws', entries: 'deps:node_modules' });
      mockGetBooleanInput({ enableCrossOsArchive: true, 'no-platform': true });

      await restoreRun();

      expect(core.saveState).toHaveBeenCalledWith('enableCrossOsArchive', 'true');
    });

    it('saves force to state', async () => {
      mockGetInput({ workspace: 'ns/ws', entries: 'deps:node_modules' });
      mockGetBooleanInput({ force: true, 'no-platform': true });

      await restoreRun();

      expect(core.saveState).toHaveBeenCalledWith('force', 'true');
    });

    it('saves verbose to state', async () => {
      mockGetInput({ workspace: 'ns/ws', entries: 'deps:node_modules' });
      mockGetBooleanInput({ verbose: true, 'no-platform': true });

      await restoreRun();

      expect(core.saveState).toHaveBeenCalledWith('verbose', 'true');
    });

    it('saves all flags together', async () => {
      mockGetInput({ workspace: 'ns/ws', entries: 'deps:node_modules' });
      mockGetBooleanInput({
        'no-platform': true,
        enableCrossOsArchive: true,
        force: true,
        verbose: true,
      });

      await restoreRun();

      expect(core.saveState).toHaveBeenCalledWith('no-platform', 'true');
      expect(core.saveState).toHaveBeenCalledWith('enableCrossOsArchive', 'true');
      expect(core.saveState).toHaveBeenCalledWith('force', 'true');
      expect(core.saveState).toHaveBeenCalledWith('verbose', 'true');
    });
  });

  describe('save.ts reads flags from state and passes correct CLI args', () => {
    it('passes --force --no-platform --verbose when state flags are true', async () => {
      mockGetInput({});
      mockGetBooleanInput({});
      mockGetState({
        'cache-entries': 'deps:node_modules',
        'cache-workspace': 'ns/ws',
        'cli-version': 'v1.0.1',
        'no-platform': 'true',
        enableCrossOsArchive: 'false',
        force: 'true',
        verbose: 'true',
      });

      await saveRun();

      const calls = (exec.exec as jest.Mock).mock.calls;
      const saveCall = calls.find(
        (c: any[]) => c[0] === 'boringcache' && Array.isArray(c[1]) && c[1][0] === 'save'
      );
      expect(saveCall).toBeTruthy();
      const args = saveCall[1] as string[];
      expect(args).toContain('--force');
      expect(args).toContain('--no-platform');
      expect(args).toContain('--verbose');
    });

    it('passes --no-platform when enableCrossOsArchive state is true', async () => {
      mockGetInput({});
      mockGetBooleanInput({});
      mockGetState({
        'cache-entries': 'deps:node_modules',
        'cache-workspace': 'ns/ws',
        'cli-version': 'v1.0.1',
        'no-platform': 'false',
        enableCrossOsArchive: 'true',
        force: 'false',
        verbose: 'false',
      });

      await saveRun();

      const calls = (exec.exec as jest.Mock).mock.calls;
      const saveCall = calls.find(
        (c: any[]) => c[0] === 'boringcache' && Array.isArray(c[1]) && c[1][0] === 'save'
      );
      expect(saveCall).toBeTruthy();
      const args = saveCall[1] as string[];
      expect(args).toContain('--no-platform');
      expect(args).not.toContain('--force');
      expect(args).not.toContain('--verbose');
    });

    it('passes no extra CLI args when all state flags are false', async () => {
      mockGetInput({});
      mockGetBooleanInput({});
      mockGetState({
        'cache-entries': 'deps:node_modules',
        'cache-workspace': 'ns/ws',
        'cli-version': 'v1.0.1',
        'no-platform': 'false',
        enableCrossOsArchive: 'false',
        force: 'false',
        verbose: 'false',
      });

      await saveRun();

      const calls = (exec.exec as jest.Mock).mock.calls;
      const saveCall = calls.find(
        (c: any[]) => c[0] === 'boringcache' && Array.isArray(c[1]) && c[1][0] === 'save'
      );
      expect(saveCall).toBeTruthy();
      const args = saveCall[1] as string[];
      expect(args).toEqual(['save', 'ns/ws', 'deps:node_modules']);
    });

    it('passes --exclude when exclude state is set', async () => {
      mockGetInput({});
      mockGetBooleanInput({});
      mockGetState({
        'cache-entries': 'deps:node_modules',
        'cache-workspace': 'ns/ws',
        'cli-version': 'v1.0.1',
        'cache-exclude': '*.log',
        'no-platform': 'false',
        enableCrossOsArchive: 'false',
        force: 'false',
        verbose: 'false',
      });

      await saveRun();

      const calls = (exec.exec as jest.Mock).mock.calls;
      const saveCall = calls.find(
        (c: any[]) => c[0] === 'boringcache' && Array.isArray(c[1]) && c[1][0] === 'save'
      );
      expect(saveCall).toBeTruthy();
      const args = saveCall[1] as string[];
      expect(args).toContain('--exclude');
      expect(args).toContain('*.log');
    });
  });

  describe('Full round-trip: restore saves state → save reads it', () => {
    it('flags set during restore are passed through to save', async () => {
      // Step 1: Run restore with all flags enabled
      mockGetInput({ workspace: 'ns/ws', entries: 'deps:node_modules' });
      mockGetBooleanInput({
        'no-platform': true,
        enableCrossOsArchive: true,
        force: true,
        verbose: true,
      });

      await restoreRun();

      // Capture what restore saved to state
      const saveStateCalls = (core.saveState as jest.Mock).mock.calls;
      const savedState: { [key: string]: string } = {};
      for (const [key, value] of saveStateCalls) {
        savedState[key] = value;
      }

      // Step 2: Run save using the captured state
      jest.clearAllMocks();
      (exec.exec as jest.Mock).mockResolvedValue(0);

      mockGetInput({});
      mockGetBooleanInput({});
      mockGetState(savedState);

      await saveRun();

      const calls = (exec.exec as jest.Mock).mock.calls;
      const saveCall = calls.find(
        (c: any[]) => c[0] === 'boringcache' && Array.isArray(c[1]) && c[1][0] === 'save'
      );
      expect(saveCall).toBeTruthy();
      const args = saveCall[1] as string[];
      expect(args).toContain('--force');
      expect(args).toContain('--no-platform');
      expect(args).toContain('--verbose');
      expect(args).toContain('ns/ws');
      expect(args).toContain('deps:node_modules');
    });

    it('round-trip with all flags false passes no extra args', async () => {
      mockGetInput({ workspace: 'ns/ws', entries: 'deps:node_modules' });
      mockGetBooleanInput({ 'no-platform': true });

      await restoreRun();

      const saveStateCalls = (core.saveState as jest.Mock).mock.calls;
      const savedState: { [key: string]: string } = {};
      for (const [key, value] of saveStateCalls) {
        savedState[key] = value;
      }

      jest.clearAllMocks();
      (exec.exec as jest.Mock).mockResolvedValue(0);

      mockGetInput({});
      mockGetBooleanInput({});
      mockGetState(savedState);

      await saveRun();

      const calls = (exec.exec as jest.Mock).mock.calls;
      const saveCall = calls.find(
        (c: any[]) => c[0] === 'boringcache' && Array.isArray(c[1]) && c[1][0] === 'save'
      );
      expect(saveCall).toBeTruthy();
      const args = saveCall[1] as string[];
      expect(args).toContain('--no-platform');
      expect(args).not.toContain('--force');
      expect(args).not.toContain('--verbose');
    });
  });

  describe('save-only.ts passes all flags', () => {
    it('passes --force --no-platform --verbose --exclude', async () => {
      mockGetInput({
        workspace: 'ns/ws',
        entries: 'deps:node_modules',
        exclude: '*.tmp',
      });
      mockGetBooleanInput({
        force: true,
        'no-platform': true,
        verbose: true,
      });

      await saveOnlyRun();

      const calls = (exec.exec as jest.Mock).mock.calls;
      const saveCall = calls.find(
        (c: any[]) => c[0] === 'boringcache' && Array.isArray(c[1]) && c[1][0] === 'save'
      );
      expect(saveCall).toBeTruthy();
      const args = saveCall[1] as string[];
      expect(args).toContain('--force');
      expect(args).toContain('--no-platform');
      expect(args).toContain('--verbose');
      expect(args).toContain('--exclude');
      expect(args).toContain('*.tmp');
    });

    it('enableCrossOsArchive maps to --no-platform', async () => {
      mockGetInput({
        workspace: 'ns/ws',
        entries: 'deps:node_modules',
      });
      mockGetBooleanInput({
        enableCrossOsArchive: true,
      });

      await saveOnlyRun();

      const calls = (exec.exec as jest.Mock).mock.calls;
      const saveCall = calls.find(
        (c: any[]) => c[0] === 'boringcache' && Array.isArray(c[1]) && c[1][0] === 'save'
      );
      expect(saveCall).toBeTruthy();
      const args = saveCall[1] as string[];
      expect(args).toContain('--no-platform');
    });

    it('passes no extra args when all flags are false', async () => {
      mockGetInput({
        workspace: 'ns/ws',
        entries: 'deps:node_modules',
      });
      mockGetBooleanInput({});

      await saveOnlyRun();

      const calls = (exec.exec as jest.Mock).mock.calls;
      const saveCall = calls.find(
        (c: any[]) => c[0] === 'boringcache' && Array.isArray(c[1]) && c[1][0] === 'save'
      );
      expect(saveCall).toBeTruthy();
      const args = saveCall[1] as string[];
      expect(args).toEqual(['save', 'ns/ws', 'deps:node_modules']);
    });

    it('supports actions/cache format with path + key', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';

      mockGetInput({
        path: '~/.npm',
        key: 'deps-hash123',
      });
      mockGetBooleanInput({ 'no-platform': true });

      await saveOnlyRun();

      const calls = (exec.exec as jest.Mock).mock.calls;
      const saveCall = calls.find(
        (c: any[]) => c[0] === 'boringcache' && Array.isArray(c[1]) && c[1][0] === 'save'
      );
      expect(saveCall).toBeTruthy();
      const args = saveCall[1] as string[];
      expect(args[1]).toBe('owner/repo');
      expect(args[2]).toMatch(/deps-hash123:.*\.npm/);
      expect(args).toContain('--no-platform');
    });
  });

  describe('restore-only.ts passes all flags', () => {
    it('passes --no-platform --fail-on-cache-miss --lookup-only --verbose', async () => {
      mockGetInput({
        workspace: 'ns/ws',
        entries: 'deps:node_modules',
      });
      mockGetBooleanInput({
        'no-platform': true,
        'fail-on-cache-miss': true,
        'lookup-only': true,
        verbose: true,
      });

      const { execBoringCache } = require('@boringcache/action-core');
      execBoringCache.mockResolvedValue(0);

      await restoreOnlyRun();

      const calls = execBoringCache.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);
      const restoreCall = calls.find(
        (c: any[]) => Array.isArray(c[0]) && c[0][0] === 'restore'
      );
      expect(restoreCall).toBeTruthy();
      const args = restoreCall[0] as string[];
      expect(args).toContain('--no-platform');
      expect(args).toContain('--fail-on-cache-miss');
      expect(args).toContain('--lookup-only');
      expect(args).toContain('--verbose');
    });

    it('enableCrossOsArchive maps to --no-platform', async () => {
      mockGetInput({
        workspace: 'ns/ws',
        entries: 'deps:node_modules',
      });
      mockGetBooleanInput({
        enableCrossOsArchive: true,
      });

      const { execBoringCache } = require('@boringcache/action-core');
      execBoringCache.mockResolvedValue(0);

      await restoreOnlyRun();

      const calls = execBoringCache.mock.calls;
      const restoreCall = calls.find(
        (c: any[]) => Array.isArray(c[0]) && c[0][0] === 'restore'
      );
      expect(restoreCall).toBeTruthy();
      const args = restoreCall[0] as string[];
      expect(args).toContain('--no-platform');
    });

    it('passes no extra args when all flags are false', async () => {
      mockGetInput({
        workspace: 'ns/ws',
        entries: 'deps:node_modules',
      });
      mockGetBooleanInput({});

      const { execBoringCache } = require('@boringcache/action-core');
      execBoringCache.mockResolvedValue(0);

      await restoreOnlyRun();

      const calls = execBoringCache.mock.calls;
      const restoreCall = calls.find(
        (c: any[]) => Array.isArray(c[0]) && c[0][0] === 'restore'
      );
      expect(restoreCall).toBeTruthy();
      const args = restoreCall[0] as string[];
      expect(args).toEqual(['restore', 'ns/ws', 'deps:node_modules']);
    });

    it('restore-key fallback with platform suffix', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';

      mockGetInput({
        path: '~/.npm',
        key: 'deps-hash123',
        'restore-keys': 'deps-v1',
      });
      mockGetBooleanInput({ 'no-platform': true });

      const { execBoringCache } = require('@boringcache/action-core');
      // Primary key misses, restore key hits
      execBoringCache
        .mockResolvedValueOnce(1)  // primary miss
        .mockResolvedValueOnce(0); // restore key hit

      await restoreOnlyRun();

      expect(execBoringCache).toHaveBeenCalledTimes(2);
      // Second call should contain the restore key
      const fallbackArgs = execBoringCache.mock.calls[1][0] as string[];
      expect(fallbackArgs[0]).toBe('restore');
      expect(fallbackArgs[1]).toBe('owner/repo');
      expect(fallbackArgs[2]).toMatch(/^deps-v1:/);
      expect(fallbackArgs).toContain('--no-platform');

      expect(core.setOutput).toHaveBeenCalledWith('cache-hit', 'true');
      expect(core.setOutput).toHaveBeenCalledWith('cache-matched-key', 'deps-v1');
    });

    it('supports actions/cache format with path + key', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';

      mockGetInput({
        path: '~/.npm',
        key: 'deps-hash123',
      });
      mockGetBooleanInput({ 'no-platform': true });

      const { execBoringCache } = require('@boringcache/action-core');
      execBoringCache.mockResolvedValue(0);

      await restoreOnlyRun();

      const calls = execBoringCache.mock.calls;
      const restoreCall = calls.find(
        (c: any[]) => Array.isArray(c[0]) && c[0][0] === 'restore'
      );
      expect(restoreCall).toBeTruthy();
      const args = restoreCall[0] as string[];
      expect(args[1]).toBe('owner/repo');
      expect(args[2]).toMatch(/deps-hash123:.*\.npm/);
    });

    it('fail-on-cache-miss sets failed when no cache hit', async () => {
      mockGetInput({
        workspace: 'ns/ws',
        entries: 'deps:node_modules',
      });
      mockGetBooleanInput({
        'fail-on-cache-miss': true,
      });

      const { execBoringCache } = require('@boringcache/action-core');
      execBoringCache.mockResolvedValue(1);

      await restoreOnlyRun();

      expect(core.setFailed).toHaveBeenCalledWith('Cache miss and fail-on-cache-miss is enabled');
    });
  });
});
