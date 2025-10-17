import * as core from '@actions/core';

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

jest.mock('fs', () => ({
  promises: {
    chmod: jest.fn(),
    rename: jest.fn(),
  },
}));

const originalEnv = process.env;

beforeEach(() => {
  jest.resetAllMocks();
  process.env = { ...originalEnv };
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
