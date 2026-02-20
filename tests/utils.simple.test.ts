import * as os from 'os';
import * as core from '@actions/core';
import {
  validateInputs,
  getPlatformSuffix,
  getWorkspace,
  ensureBoringCache,
  parseEntries,
} from '../lib/utils';

describe('Utils (Simple)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.BORINGCACHE_API_TOKEN;
  });

  describe('validateInputs', () => {
    it('should accept workspace format', () => {
      expect(() => validateInputs({
        workspace: 'my-org/my-project',
        entries: 'deps:node_modules',
      })).not.toThrow();
    });

    it('should accept actions/cache format', () => {
      expect(() => validateInputs({
        path: '~/.npm',
        key: 'deps-v1',
      })).not.toThrow();
    });

    it('should reject invalid inputs', () => {
      expect(() => validateInputs({})).toThrow(
        'Either (workspace + entries) or (path + key) inputs are required'
      );
    });

    it('should reject invalid workspace format', () => {
      expect(() => validateInputs({
        workspace: 'invalid',
        entries: 'deps:node_modules',
      })).toThrow('Workspace must be in format "namespace/workspace"');
    });
  });

  describe('getPlatformSuffix', () => {
    it('should return empty when disabled (noPlatform=true)', () => {
      expect(getPlatformSuffix(true, false)).toBe('');
    });

    it('should return platform suffix when enabled (noPlatform=false)', () => {
      const result = getPlatformSuffix(false, false);
      const expectedPlatform = os.platform() === 'darwin' ? 'darwin' : 'linux';
      const expectedArch = os.arch() === 'arm64' ? 'arm64' : 'amd64';
      expect(result).toBe(`-${expectedPlatform}-${expectedArch}`);
    });

    it('should return empty when enableCrossOsArchive=true', () => {
      expect(getPlatformSuffix(false, true)).toBe('');
    });
  });

  describe('getWorkspace', () => {
    it('should return provided workspace', () => {
      expect(getWorkspace({ workspace: 'my-org/my-project' })).toBe('my-org/my-project');
    });

    it('should fallback to repository', () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      expect(getWorkspace({})).toBe('owner/repo');
    });

    it('should fallback to default', () => {
      expect(getWorkspace({})).toBe('default/default');
    });
  });

  describe('parseEntries Windows path handling', () => {
    it('should handle Windows drive paths in restore format', () => {
      const entries = parseEntries('test-key:D:\\a\\action\\action\\test-cache', 'restore');
      expect(entries).toEqual([
        {
          tag: 'test-key',
          restorePath: expect.stringContaining('D:\\a\\action\\action\\test-cache'),
          savePath: expect.stringContaining('D:\\a\\action\\action\\test-cache')
        }
      ]);
    });

    it('should handle the exact failing Windows case', () => {
      const entries = parseEntries('test-windows-latest-17921180603:D:\\a\\action\\action\\test-cache', 'restore');
      expect(entries).toEqual([
        {
          tag: 'test-windows-latest-17921180603',
          restorePath: expect.stringContaining('D:\\a\\action\\action\\test-cache'),
          savePath: expect.stringContaining('D:\\a\\action\\action\\test-cache')
        }
      ]);
    });

    it('should handle Windows drive paths in unified tag:path format', () => {
      const entries = parseEntries('test-key:D:\\a\\action\\action\\test-cache', 'save');
      expect(entries).toEqual([
        {
          tag: 'test-key',
          restorePath: expect.stringContaining('D:\\a\\action\\action\\test-cache'),
          savePath: expect.stringContaining('D:\\a\\action\\action\\test-cache')
        }
      ]);
    });

    it('should handle multiple Windows paths', () => {
      const entries = parseEntries('key1:C:\\temp,key2:D:\\cache\\dir', 'restore');
      expect(entries).toHaveLength(2);
      expect(entries[0].tag).toBe('key1');
      expect(entries[0].restorePath).toContain('C:\\temp');
      expect(entries[0].savePath).toContain('C:\\temp');
      expect(entries[1].tag).toBe('key2');
      expect(entries[1].restorePath).toContain('D:\\cache\\dir');
      expect(entries[1].savePath).toContain('D:\\cache\\dir');
    });

    it('should support distinct restore and save paths', () => {
      const entries = parseEntries('docker-cache:/tmp/.buildx-cache-work=>/tmp/.buildx-cache-store', 'restore');
      expect(entries).toEqual([
        {
          tag: 'docker-cache',
          restorePath: expect.stringContaining('/tmp/.buildx-cache-work'),
          savePath: expect.stringContaining('/tmp/.buildx-cache-store')
        }
      ]);
    });
  });

  describe('ensureBoringCache', () => {
    beforeEach(() => {
      (core.setSecret as jest.Mock).mockClear();
    });

    it('should call action-core ensureBoringCache', async () => {
      await ensureBoringCache({ version: 'v1.1.1' });

      // ensureBoringCache is mocked in setup.ts
      const { ensureBoringCache: mockedEnsure } = require('@boringcache/action-core');
      expect(mockedEnsure).toHaveBeenCalledWith({ version: 'v1.1.1' });
    });

    it('should mask token when available (auth is automatic)', async () => {
      process.env.BORINGCACHE_API_TOKEN = 'test-token';

      await ensureBoringCache({ version: 'latest' });

      expect(core.setSecret).toHaveBeenCalledWith('test-token');
    });
  });
});
