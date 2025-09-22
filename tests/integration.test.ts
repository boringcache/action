import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { run } from '../lib/restore';
import { mockGetInput, mockGetBooleanInput } from './setup';

describe('Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.BORINGCACHE_API_TOKEN;
    

    (exec.exec as jest.Mock).mockResolvedValue(0);
  });

  describe('Workspace Format Integration', () => {
    it('should execute boringcache restore with correct arguments', async () => {
      mockGetInput({
        workspace: 'my-org/my-project',
        entries: 'deps:node_modules,build:dist',
      });
      mockGetBooleanInput({});
      
      await run();
      

      expect(exec.exec).toHaveBeenCalledWith('boringcache', ['--version'], { 
        ignoreReturnCode: true, 
        silent: true 
      });
      

      expect(exec.exec).toHaveBeenCalledWith(
        'boringcache',
        ['restore', 'my-org/my-project', 'deps:node_modules,build:dist'],
        expect.any(Object)
      );
      

      expect(core.setOutput).toHaveBeenCalledWith('cache-hit', 'true');
    });

    it('should handle cache miss gracefully', async () => {
      mockGetInput({
        workspace: 'my-org/my-project',
        entries: 'deps:node_modules',
      });
      mockGetBooleanInput({});
      

      (exec.exec as jest.Mock)
        .mockImplementation((command: string, args?: string[]) => {
          if (command === 'boringcache' && args?.[0] === '--version') {
            return Promise.resolve(0);
          }
          if (command === 'boringcache' && args?.[0] === 'restore') {
            return Promise.resolve(1); // Exit code 1 = cache miss
          }
          return Promise.resolve(0);
        });
      
      await run();
      
      expect(core.setOutput).toHaveBeenCalledWith('cache-hit', 'false');
    });
  });

  describe('actions/cache Compatibility', () => {
    it('should convert actions/cache format to workspace format', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      
      mockGetInput({
        path: '~/.npm',
        key: 'deps-hash123',
      });
      mockGetBooleanInput({});
      
      await run();
      

      expect(exec.exec).toHaveBeenCalledWith(
        'boringcache',
        ['restore', 'owner/repo', expect.stringMatching(/deps-hash123:.*\.npm/)],
        expect.any(Object)
      );
    });

    it('should handle restore-keys fallback', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      
      mockGetInput({
        path: '~/.npm',
        key: 'deps-hash123',
        'restore-keys': 'deps-v1\ndeps-',
      });
      mockGetBooleanInput({});
      

      (exec.exec as jest.Mock)
        .mockImplementation((command: string, args?: string[]) => {
          if (command === 'boringcache' && args?.[0] === '--version') {
            return Promise.resolve(0);
          }
          if (command === 'boringcache' && args?.[0] === 'restore') {
            const entries = args[2];
            if (entries?.includes('deps-hash123')) {
              return Promise.resolve(1); // Primary key miss
            } else if (entries?.includes('deps-v1')) {
              return Promise.resolve(0); // Restore key hit
            }
          }
          return Promise.resolve(0);
        });
      
      await run();
      

      expect(exec.exec).toHaveBeenCalledWith(
        'boringcache',
        ['restore', 'owner/repo', expect.stringMatching(/deps-hash123:.*\.npm/)],
        expect.any(Object)
      );
      

      expect(exec.exec).toHaveBeenCalledWith(
        'boringcache',
        ['restore', 'owner/repo', expect.stringMatching(/deps-v1:.*\.npm/)],
        expect.any(Object)
      );
      
      expect(core.setOutput).toHaveBeenCalledWith('cache-hit', 'true');
      expect(core.setOutput).toHaveBeenCalledWith('cache-matched-key', 'deps-v1');
    });
  });

  describe('CLI Installation', () => {
    it('should install CLI when not available', async () => {
      mockGetInput({
        workspace: 'my-org/my-project',
        entries: 'deps:node_modules',
      });
      mockGetBooleanInput({});
      

      (exec.exec as jest.Mock)
        .mockImplementation((command: string, args?: string[]) => {
          if (command === 'boringcache' && args?.[0] === '--version') {
            return Promise.resolve(1); // CLI not available
          }
          return Promise.resolve(0); // Installation and restore succeed
        });
      
      await run();
      

      expect(exec.exec).toHaveBeenCalledWith(
        'bash',
        ['-c', 'curl -sSL https://install.boringcache.com/install.sh | sh'],
        expect.any(Object)
      );
      

      expect(exec.exec).toHaveBeenCalledWith(
        'boringcache',
        ['restore', 'my-org/my-project', 'deps:node_modules'],
        expect.any(Object)
      );
    });

    it('should authenticate when token is provided', async () => {
      process.env.BORINGCACHE_API_TOKEN = 'test-token';
      
      mockGetInput({
        workspace: 'my-org/my-project',
        entries: 'deps:node_modules',
      });
      mockGetBooleanInput({});
      
      await run();
      

      expect(exec.exec).toHaveBeenCalledWith(
        'boringcache',
        ['auth', '--token', 'test-token'],
        { silent: true }
      );
    });
  });

  describe('Error Handling', () => {
    it('should fail gracefully on invalid inputs', async () => {
      mockGetInput({}); // No inputs
      mockGetBooleanInput({});
      
      await run();
      
      expect(core.setFailed).toHaveBeenCalledWith(
        'Cache restore failed: Either (workspace + entries) or (path + key) inputs are required'
      );
    });

    it('should handle CLI installation failure', async () => {
      mockGetInput({
        workspace: 'my-org/my-project',
        entries: 'deps:node_modules',
      });
      mockGetBooleanInput({});
      

      (exec.exec as jest.Mock)
        .mockImplementation((command: string, args?: string[]) => {
          if (command === 'boringcache' && args?.[0] === '--version') {
            return Promise.resolve(1);
          }
          if (command === 'bash') {
            return Promise.reject(new Error('Installation failed'));
          }
          return Promise.resolve(0);
        });
      
      await run();
      
      expect(core.setFailed).toHaveBeenCalledWith(
        'Cache restore failed: Failed to install BoringCache CLI: Error: Installation failed'
      );
    });
  });
});