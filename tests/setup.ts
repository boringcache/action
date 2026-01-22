import * as core from '@actions/core';
import * as exec from '@actions/exec';

jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  getBooleanInput: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  setSecret: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  debug: jest.fn(),
  addPath: jest.fn(),
  exportVariable: jest.fn(),
  saveState: jest.fn(),
}));

jest.mock('@actions/exec', () => ({
  exec: jest.fn(),
}));

jest.mock('@actions/cache', () => ({
  restoreCache: jest.fn().mockResolvedValue(null),
  saveCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@actions/tool-cache', () => ({
  find: jest.fn().mockReturnValue('/mock/tool-cache'),
  cacheDir: jest.fn().mockResolvedValue('/mock/tool-cache'),
  downloadTool: jest.fn().mockResolvedValue('/tmp/mock-download'),
  extractTar: jest.fn().mockResolvedValue('/tmp/mock-extract'),
  extractZip: jest.fn().mockResolvedValue('/tmp/mock-extract'),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    chmod: jest.fn().mockResolvedValue(undefined),
    rename: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    copyFile: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockRejectedValue(new Error('ENOENT')),
  },
}));

// Store reference to the mocked functions
const mockEnsureBoringCache = jest.fn();
const mockExecBoringCache = jest.fn();

// Mock @boringcache/action-core
jest.mock('@boringcache/action-core', () => ({
  ensureBoringCache: mockEnsureBoringCache,
  execBoringCache: mockExecBoringCache,
}));

const originalEnv = process.env;

beforeEach(() => {
  jest.resetAllMocks();
  process.env = { ...originalEnv };

  // Re-configure the action-core mocks after resetAllMocks
  const execModule = require('@actions/exec');
  const coreModule = require('@actions/core');

  // Configure ensureBoringCache mock to mask tokens
  mockEnsureBoringCache.mockImplementation(async (options: { version: string; token?: string }) => {
    const token = options?.token || process.env.BORINGCACHE_API_TOKEN;
    if (token) {
      coreModule.setSecret(token);
    }
  });

  // Configure execBoringCache to delegate to exec.exec
  mockExecBoringCache.mockImplementation(async (args: string[], options?: any) => {
    return execModule.exec('boringcache', args, options);
  });
});

afterEach(() => {
  process.env = originalEnv;
});

export const mockGetInput = (inputs: {[key: string]: string}) => {
  (core.getInput as jest.Mock).mockImplementation((name: string) => inputs[name] || '');
};

export const mockGetBooleanInput = (inputs: {[key: string]: boolean}) => {
  (core.getBooleanInput as jest.Mock).mockImplementation((name: string) => inputs[name] || false);
};
