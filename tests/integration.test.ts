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
      mockGetBooleanInput({'enable-platform-suffix': false});
      
      await run();
      

      expect(exec.exec).toHaveBeenCalledWith('boringcache', ['--version'], { 
        ignoreReturnCode: true, 
        silent: true 
      });
      

      expect(exec.exec).toHaveBeenCalledWith(
        'boringcache',
        ['restore', 'my-org/my-project', 'deps:node_modules,build:dist', '--no-platform'],
        expect.any(Object)
      );
      
      // No cache-hit outputs - CLI handles all logic
    });

    it('should handle cache miss gracefully', async () => {
      mockGetInput({
        workspace: 'my-org/my-project',
        entries: 'deps:node_modules',
      });
      mockGetBooleanInput({'enable-platform-suffix': false});
      

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
      
      // No cache-hit outputs - CLI handles all logic
    });
  });

  describe('actions/cache Compatibility', () => {
    it('should convert actions/cache format to workspace format', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      
      mockGetInput({
        path: '~/.npm',
        key: 'deps-hash123',
      });
      mockGetBooleanInput({'enable-platform-suffix': false});
      
      await run();
      

      expect(exec.exec).toHaveBeenCalledWith(
        'boringcache',
        ['restore', 'owner/repo', expect.stringMatching(/deps-hash123:.*\.npm/), '--no-platform'],
        expect.any(Object)
      );
    });

    it('should convert actions/cache format with restore-keys', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      
      mockGetInput({
        path: '~/.npm',
        key: 'deps-hash123',
        'restore-keys': 'deps-v1\ndeps-',
      });
      mockGetBooleanInput({'enable-platform-suffix': false});
      
      await run();
      
      // Should only call restore once with primary key (simplified)
      expect(exec.exec).toHaveBeenCalledWith(
        'boringcache',
        ['restore', 'owner/repo', expect.stringMatching(/deps-hash123:.*\.npm/), '--no-platform'],
        expect.any(Object)
      );
    });
  });

  describe('CLI Installation', () => {
    it('should install CLI when not available', async () => {
      mockGetInput({
        workspace: 'my-org/my-project',
        entries: 'deps:node_modules',
      });
      mockGetBooleanInput({'enable-platform-suffix': false});
      

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
        ['restore', 'my-org/my-project', 'deps:node_modules', '--no-platform'],
        expect.any(Object)
      );
    });

    it('should authenticate when token is provided', async () => {
      process.env.BORINGCACHE_API_TOKEN = 'test-token';
      
      mockGetInput({
        workspace: 'my-org/my-project',
        entries: 'deps:node_modules',
      });
      mockGetBooleanInput({'enable-platform-suffix': false});
      
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
      mockGetBooleanInput({'enable-platform-suffix': false});
      
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
      mockGetBooleanInput({'enable-platform-suffix': false});
      

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