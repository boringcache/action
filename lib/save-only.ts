import * as core from '@actions/core';
import * as fs from 'fs';
import { ensureBoringCache, getCacheConfig, validateInputs, resolvePaths, execBoringCache } from './utils';

async function run(): Promise<void> {
  try {
    const cliVersion = core.getInput('cli-version') || 'v1.0.0';
    const inputs = {
      path: core.getInput('path', { required: true }),
      key: core.getInput('key', { required: true }),
      enableCrossOsArchive: core.getBooleanInput('enableCrossOsArchive'),
      noPlatform: core.getBooleanInput('no-platform'),
      force: core.getBooleanInput('force'),
      verbose: core.getBooleanInput('verbose'),
      exclude: core.getInput('exclude'),
    };

    validateInputs(inputs);
    await ensureBoringCache({ version: cliVersion });

    const config = await getCacheConfig(inputs.key, inputs.enableCrossOsArchive, inputs.noPlatform);
    const resolvedPaths = resolvePaths(inputs.path);
    
    await saveCache(config.workspace, resolvedPaths, config.fullKey, inputs.force, inputs.verbose, inputs.enableCrossOsArchive, inputs.noPlatform, inputs.exclude);

  } catch (error) {
    core.setFailed(`Cache save failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function saveCache(workspace: string, paths: string, key: string, force: boolean = false, verbose: boolean = false, enableCrossOsArchive: boolean = false, noPlatform: boolean = false, exclude: string = ''): Promise<void> {
  const pathList = paths.split('\n').map(p => p.trim()).filter(p => p);
  const validPaths: string[] = [];
  

  for (const cachePath of pathList) {
    try {
      await fs.promises.access(cachePath);
      validPaths.push(cachePath);
    } catch {
      core.warning(`Path does not exist: ${cachePath}`);
    }
  }

  if (validPaths.length === 0) {
    core.warning('No valid cache paths found, skipping save');
    return;
  }

  core.info(`💾 Saving cache: ${key} ← ${validPaths.join(', ')}`);
  for (const cachePath of validPaths) {
    const args = ['save', workspace, `${key}:${cachePath}`];
    if (force) {
      args.push('--force');
    }
    // Translate enableCrossOsArchive to --no-platform
    if (enableCrossOsArchive || noPlatform) {
      args.push('--no-platform');
    }
    if (verbose) {
      args.push('--verbose');
    }
    if (exclude) {
      args.push('--exclude', exclude);
    }
    const result = await execBoringCache(args, { ignoreReturnCode: true });

    if (result === 0) {
      core.info(`✅ Saved: ${cachePath}`);
    } else {
      core.warning(`⚠️ Failed to save: ${cachePath}`);
    }
  }
}

run();