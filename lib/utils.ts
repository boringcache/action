import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export interface CacheConfig {
  workspace: string;
  fullKey: string;
  platformSuffix: string;
}

export async function setupBoringCache(): Promise<void> {
  try {
    const result = await exec.exec('boringcache', ['--version'], { 
      ignoreReturnCode: true, 
      silent: true 
    });
    if (result === 0) {
      core.debug('BoringCache CLI already available');
    } else {
      await downloadAndInstallCLI();
    }
  } catch (error) {
    await downloadAndInstallCLI();
  }
  const token = process.env.BORINGCACHE_API_TOKEN;
  if (token) {
    try {
      await exec.exec('boringcache', ['auth', '--token', token], { silent: true });
      core.debug('✅ BoringCache authenticated');
    } catch (error) {
      core.warning(`Authentication failed: ${error}`);
    }
  }
}

async function downloadAndInstallCLI(): Promise<void> {
  core.info('📥 Installing BoringCache CLI using official installer...');
  
  try {
    if (os.platform() === 'win32') {
      await exec.exec('powershell', ['-Command', 'irm https://install.boringcache.com/install.ps1 | iex'], {
        listeners: {
          stdout: (data: Buffer) => {
            core.info(data.toString());
          },
          stderr: (data: Buffer) => {
            core.info(data.toString());
          }
        }
      });
      
      core.addPath('C:\\Users\\runneradmin\\.boringcache\\bin');
      core.exportVariable('PATH', `C:\\Users\\runneradmin\\.boringcache\\bin;${process.env.PATH}`);
    } else {
      await exec.exec('bash', ['-c', 'curl -sSL https://install.boringcache.com/install.sh | sh'], {
        listeners: {
          stdout: (data: Buffer) => {
            core.info(data.toString());
          },
          stderr: (data: Buffer) => {
            core.info(data.toString());
          }
        }
      });
      
      const homeDir = os.homedir();
      core.addPath(`${homeDir}/.boringcache/bin`);
    }
    
    core.info('✅ BoringCache CLI installed successfully');
  } catch (error) {
    throw new Error(`Failed to install BoringCache CLI: ${error}`);
  }
}

export async function getCacheConfig(
  key: string, 
  enableCrossOsArchive: boolean, 
  enablePlatformSuffix: boolean = false
): Promise<CacheConfig> {
  const workspace = process.env.BORINGCACHE_WORKSPACE || 
                   process.env.GITHUB_REPOSITORY?.split('/')[1] || 
                   'default';

  let platformSuffix = '';
  if (enablePlatformSuffix && !enableCrossOsArchive) {
    const platform = os.platform() === 'darwin' ? 'darwin' : 'linux';
    const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64';
    platformSuffix = `-${platform}-${arch}`;
  }

  const fullKey = key + platformSuffix;

  return {
    workspace,
    fullKey,
    platformSuffix
  };
}

export function validateInputs(inputs: any): void {
  const hasCliFormat = inputs.workspace || inputs.entries;
  const hasCacheFormat = inputs.path || inputs.key;
  
  if (!hasCliFormat && !hasCacheFormat) {
    throw new Error('Either (workspace + entries) or (path + key) inputs are required');
  }
  
  if (hasCliFormat && hasCacheFormat) {
    core.warning('Both CLI format (workspace/entries) and actions/cache format (path/key) provided. Using CLI format.');
  }
  
  if (hasCliFormat) {
    if (!inputs.entries) {
      throw new Error('Input "entries" is required when using CLI format');
    }
  }
  
  if (hasCacheFormat && !hasCliFormat) {
    if (!inputs.path) {
      throw new Error('Input "path" is required when using actions/cache format');
    }
    if (!inputs.key) {
      throw new Error('Input "key" is required when using actions/cache format');
    }
  }
  if (inputs.workspace && !inputs.workspace.includes('/')) {
    throw new Error('Workspace must be in format "namespace/workspace" (e.g., "my-org/my-project")');
  }
}

export function resolvePaths(pathInput: string): string {
  return pathInput.split('\n')
    .map(p => p.trim())
    .filter(p => p)
    .map(cachePath => {
      if (path.isAbsolute(cachePath)) {
        return cachePath;
      }
      if (cachePath.startsWith('~/')) {
        return path.join(os.homedir(), cachePath.slice(2));
      }
      return path.resolve(process.cwd(), cachePath);
    })
    .join('\n');
}

export interface CacheEntry {
  path: string;
  tag: string;
}

export function parseEntries(entriesInput: string, action: 'save' | 'restore'): CacheEntry[] {
  return entriesInput.split(',')
    .map(entry => entry.trim())
    .filter(entry => entry)
    .map(entry => {
      // Both save and restore now use tag:path format (unified)
      // Find the first colon for the separator
      const colonIndex = entry.indexOf(':');
      
      if (colonIndex === -1) {
        throw new Error(`Invalid entry format: ${entry}. Expected format: tag:path`);
      }
      
      const parts = [entry.substring(0, colonIndex), entry.substring(colonIndex + 1)];
      
      // Both save and restore use tag:path format
      return { tag: parts[0], path: resolvePath(parts[1]) };
    });
}

export function resolvePath(pathInput: string): string {
  const trimmedPath = pathInput.trim();
  if (path.isAbsolute(trimmedPath)) {
    return trimmedPath;
  }
  if (trimmedPath.startsWith('~/')) {
    return path.join(os.homedir(), trimmedPath.slice(2));
  }
  return path.resolve(process.cwd(), trimmedPath);
}

export function getPlatformSuffix(enablePlatformSuffix: boolean, enableCrossOsArchive: boolean): string {
  if (!enablePlatformSuffix || enableCrossOsArchive) {
    return '';
  }
  
  const platform = os.platform() === 'darwin' ? 'darwin' : 'linux';
  const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64';
  return `-${platform}-${arch}`;
}

export function getWorkspace(inputs: any): string {
  if (inputs.workspace) {
    return inputs.workspace;
  }
  const repo = process.env.GITHUB_REPOSITORY;
  if (repo) {
    const parts = repo.split('/');
    return `${parts[0]}/${parts[1]}`;
  }
  
  return 'default/default';
}

export function convertCacheFormatToEntries(inputs: any, action: 'save' | 'restore'): string {
  if (!inputs.path || !inputs.key) {
    throw new Error('actions/cache format requires both path and key inputs');
  }
  
  const paths = inputs.path.split('\n')
    .map((p: string) => p.trim())
    .filter((p: string) => p);
  const platformSuffix = getPlatformSuffix(inputs.enablePlatformSuffix, inputs.enableCrossOsArchive);
  const fullKey = inputs.key + platformSuffix;
  
  // Both save and restore now use tag:path format (unified)
  return paths.map((p: string) => `${fullKey}:${resolvePath(p)}`).join(',');
}