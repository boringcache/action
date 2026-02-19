import * as os from 'os';
import * as fs from 'fs';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { run } from '../lib/restore';
import { mockGetInput, mockGetBooleanInput } from './setup';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    access: jest.fn(),
  },
}));

describe('Integration Tests', () => {
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
    (fs.promises.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));
  });

  describe('Workspace Format Integration', () => {
    it('should execute boringcache restore with correct arguments', async () => {
      mockGetInput({
        workspace: 'my-org/my-project',
        entries: 'deps:node_modules,build:dist',
      });
      mockGetBooleanInput({'no-platform': true});

      await run();

      // CLI setup is handled by action-core (ensureBoringCache)
      const { ensureBoringCache } = require('@boringcache/action-core');
      expect(ensureBoringCache).toHaveBeenCalledWith({ version: 'v1.1.0' });

      // Verify restore command was called
      expect(exec.exec).toHaveBeenCalledWith(
        'boringcache',
        ['restore', 'my-org/my-project', 'deps:node_modules,build:dist', '--no-platform'],
        expect.any(Object)
      );
    });

    it('should handle cache miss gracefully', async () => {
      mockGetInput({
        workspace: 'my-org/my-project',
        entries: 'deps:node_modules',
      });
      mockGetBooleanInput({'no-platform': true});

      (exec.exec as jest.Mock)
        .mockImplementation((command: string, args?: string[], opts?: any) => {
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

      await run();
    });
  });

  it('should support distinct restore and save paths', async () => {
    mockGetInput({
      workspace: 'my-org/my-project',
      entries: 'docker:/tmp/.buildx-cache-work=>/tmp/.buildx-cache-store',
    });
    mockGetBooleanInput({'no-platform': true});

    await run();

    expect(exec.exec).toHaveBeenCalledWith(
      'boringcache',
      ['restore', 'my-org/my-project', 'docker:/tmp/.buildx-cache-work', '--no-platform'],
      expect.any(Object)
    );

    expect(core.saveState).toHaveBeenCalledWith(
      'cache-entries',
      'docker:/tmp/.buildx-cache-store'
    );
  });

  describe('actions/cache Compatibility', () => {
    it('should convert actions/cache format to workspace format', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      
      mockGetInput({
        path: '~/.npm',
        key: 'deps-hash123',
      });
      mockGetBooleanInput({'no-platform': true});
      
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
      mockGetBooleanInput({'no-platform': true});
      
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
    it('should call ensureBoringCache with version', async () => {
      const { ensureBoringCache } = require('@boringcache/action-core');

      mockGetInput({
        workspace: 'my-org/my-project',
        entries: 'deps:node_modules',
        'cli-version': 'v2.0.0',
      });
      mockGetBooleanInput({'no-platform': true});

      await run();

      expect(ensureBoringCache).toHaveBeenCalledWith({ version: 'v2.0.0' });

      expect(exec.exec).toHaveBeenCalledWith(
        'boringcache',
        ['restore', 'my-org/my-project', 'deps:node_modules', '--no-platform'],
        expect.any(Object)
      );
    });

    it('should mask token when provided (auth is automatic)', async () => {
      process.env.BORINGCACHE_API_TOKEN = 'test-token';

      mockGetInput({
        workspace: 'my-org/my-project',
        entries: 'deps:node_modules',
      });
      mockGetBooleanInput({'no-platform': true});

      await run();

      expect(core.setSecret).toHaveBeenCalledWith('test-token');
    });
  });

  describe('Error Handling', () => {
    it('should fail gracefully on invalid inputs', async () => {
      mockGetInput({}); // No inputs
      mockGetBooleanInput({'no-platform': true});
      
      await run();
      
      expect(core.setFailed).toHaveBeenCalledWith(
        'Cache restore failed: Either (workspace + entries) or (path + key) inputs are required'
      );
    });

    it('should handle CLI installation failure', async () => {
      const { ensureBoringCache } = require('@boringcache/action-core');
      ensureBoringCache.mockRejectedValueOnce(new Error('Failed to download CLI'));

      mockGetInput({
        workspace: 'my-org/my-project',
        entries: 'deps:node_modules',
      });
      mockGetBooleanInput({'no-platform': true});

      await run();

      expect(core.setFailed).toHaveBeenCalledWith(
        'Cache restore failed: Failed to download CLI'
      );
    });
  });
});
