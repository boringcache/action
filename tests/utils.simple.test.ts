import * as os from 'os';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import {
  validateInputs,
  getPlatformSuffix,
  getWorkspace,
  setupBoringCache,
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
    it('should return empty when disabled', () => {
      expect(getPlatformSuffix(false, false)).toBe('');
    });

    it('should return platform suffix when enabled', () => {
      const result = getPlatformSuffix(true, false);
      const expectedPlatform = os.platform() === 'darwin' ? 'darwin' : 'linux';
      const expectedArch = os.arch() === 'arm64' ? 'arm64' : 'amd64';
      expect(result).toBe(`-${expectedPlatform}-${expectedArch}`);
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
        { tag: 'test-key', path: expect.stringContaining('D:\\a\\action\\action\\test-cache') }
      ]);
    });

    it('should handle the exact failing Windows case', () => {
      const entries = parseEntries('test-windows-latest-17921180603:D:\\a\\action\\action\\test-cache', 'restore');
      expect(entries).toEqual([
        { tag: 'test-windows-latest-17921180603', path: expect.stringContaining('D:\\a\\action\\action\\test-cache') }
      ]);
    });

    it('should handle Windows drive paths in unified tag:path format', () => {
      const entries = parseEntries('test-key:D:\\a\\action\\action\\test-cache', 'save');
      expect(entries).toEqual([
        { tag: 'test-key', path: expect.stringContaining('D:\\a\\action\\action\\test-cache') }
      ]);
    });

    it('should handle multiple Windows paths', () => {
      const entries = parseEntries('key1:C:\\temp,key2:D:\\cache\\dir', 'restore');
      expect(entries).toHaveLength(2);
      expect(entries[0].tag).toBe('key1');
      expect(entries[0].path).toContain('C:\\temp');
      expect(entries[1].tag).toBe('key2');
      expect(entries[1].path).toContain('D:\\cache\\dir');
    });
  });

  describe('setupBoringCache', () => {
    beforeEach(() => {
      (exec.exec as jest.Mock).mockResolvedValue(0);
    });

    it('should check CLI availability', async () => {
      await setupBoringCache();
      
      expect(exec.exec).toHaveBeenCalledWith('boringcache', ['--version'], {
        ignoreReturnCode: true,
        silent: true
      });
    });

    it('should install CLI when not available', async () => {
      (exec.exec as jest.Mock)
        .mockResolvedValueOnce(1) // version check fails
        .mockResolvedValueOnce(0); // install succeeds
      
      await setupBoringCache();
      
      expect(exec.exec).toHaveBeenCalledWith(
        'bash',
        ['-c', 'curl -sSL https://install.boringcache.com/install.sh | sh'],
        expect.any(Object)
      );
    });

    it('should authenticate when token is available', async () => {
      process.env.BORINGCACHE_API_TOKEN = 'test-token';
      
      await setupBoringCache();
      
      expect(exec.exec).toHaveBeenCalledWith(
        'boringcache',
        ['auth', '--token', 'test-token'],
        { silent: true }
      );
    });
  });
});