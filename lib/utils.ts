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
      // Use bash installer through Git Bash (available on Windows runners)
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
      
      // Add Windows installation paths (CLI installs to .local/bin on Windows)
      const homeDir = os.homedir();
      const windowsPaths = [
        `${homeDir}\\.local\\bin`,
        `${homeDir}\\.boringcache\\bin`,
        'C:\\Users\\runneradmin\\.local\\bin',
        'C:\\Users\\runneradmin\\.boringcache\\bin',
        // Git Bash paths
        `${homeDir}/.local/bin`,
        `${homeDir}/.boringcache/bin`,
        '/home/runneradmin/.local/bin',
        '/home/runneradmin/.boringcache/bin'
      ];
      
      // Add all paths
      for (const path of windowsPaths) {
        core.addPath(path);
      }
      
      // Also set PATH environment variable directly (critical for Windows!)
      const currentPath = process.env.PATH || '';
      const updatedPath = windowsPaths.join(';') + ';' + currentPath;
      core.exportVariable('PATH', updatedPath);
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
      // Add common BoringCache installation paths for Linux/macOS
      core.addPath(`${homeDir}/.boringcache/bin`);
      core.addPath(`${homeDir}/.local/bin`);
      core.addPath('/usr/local/bin');
      core.addPath('/home/runner/.boringcache/bin');
      core.addPath('/home/runner/.local/bin');
      
      // Also set PATH environment variable directly
      const currentPath = process.env.PATH || '';
      const newPaths = [
        `${homeDir}/.boringcache/bin`,
        `${homeDir}/.local/bin`,
        '/usr/local/bin',
        '/home/runner/.boringcache/bin',
        '/home/runner/.local/bin'
      ];
      const updatedPath = newPaths.join(':') + ':' + currentPath;
      core.exportVariable('PATH', updatedPath);
    }
    
    // Verify installation
    try {
      await exec.exec('boringcache', ['--version'], { 
        ignoreReturnCode: true, 
        silent: true 
      });
      core.info('✅ BoringCache CLI installed and verified successfully');
    } catch (verifyError) {
      // Try with explicit path
      const homeDir = os.homedir();
      const isWindows = os.platform() === 'win32';
      const binaryName = isWindows ? 'boringcache.exe' : 'boringcache';
      
      const possiblePaths = isWindows ? [
        `${homeDir}\\.local\\bin\\${binaryName}`,
        `${homeDir}\\.boringcache\\bin\\${binaryName}`,
        `C:\\Users\\runneradmin\\.local\\bin\\${binaryName}`,
        `C:\\Users\\runneradmin\\.boringcache\\bin\\${binaryName}`,
        // Git Bash paths
        `${homeDir}/.local/bin/${binaryName}`,
        `${homeDir}/.boringcache/bin/${binaryName}`,
      ] : [
        `${homeDir}/.boringcache/bin/boringcache`,
        `${homeDir}/.local/bin/boringcache`,
        '/usr/local/bin/boringcache',
        '/home/runner/.boringcache/bin/boringcache'
      ];
      
      let found = false;
      for (const path of possiblePaths) {
        try {
          await exec.exec(path, ['--version'], { 
            ignoreReturnCode: true, 
            silent: true 
          });
          core.info(`✅ BoringCache CLI found at: ${path}`);
          
          // Create symlink on Unix-like systems
          if (!isWindows && path !== '/usr/local/bin/boringcache') {
            await exec.exec('sudo', ['ln', '-sf', path, '/usr/local/bin/boringcache'], {
              ignoreReturnCode: true,
              silent: true
            });
          }
          found = true;
          break;
        } catch {
          continue;
        }
      }
      
      if (!found) {
        throw new Error('BoringCache CLI installed but not found in PATH. Installation may have failed.');
      }
    }
  } catch (error) {
    throw new Error(`Failed to install BoringCache CLI: ${error}`);
  }
}

export async function getCacheConfig(
  key: string, 
  enableCrossOsArchive: boolean, 
  noPlatform: boolean = false
): Promise<CacheConfig> {
  const workspace = process.env.BORINGCACHE_WORKSPACE || 
                   process.env.GITHUB_REPOSITORY?.split('/')[1] || 
                   'default';

  let platformSuffix = '';
  if (!noPlatform && !enableCrossOsArchive) {
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

export function getPlatformSuffix(noPlatform: boolean, enableCrossOsArchive: boolean): string {
  if (noPlatform || enableCrossOsArchive) {
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
  
  // Handle platform suffix logic - CLI will handle this with --no-platform flag
  // For legacy compatibility in actions/cache mode, we still need to construct the key
  const shouldDisablePlatform = inputs.noPlatform || inputs.enableCrossOsArchive || false;
  const platformSuffix = getPlatformSuffix(shouldDisablePlatform, inputs.enableCrossOsArchive);
  const fullKey = inputs.key + platformSuffix;
  
  // Both save and restore now use tag:path format (unified)
  return paths.map((p: string) => `${fullKey}:${resolvePath(p)}`).join(',');
}