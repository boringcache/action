import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import { setupBoringCache, getCacheConfig, validateInputs, resolvePaths } from './utils';

async function run(): Promise<void> {
  try {
    const inputs = {
      path: core.getInput('path', { required: true }),
      key: core.getInput('key', { required: true }),
      enableCrossOsArchive: core.getBooleanInput('enableCrossOsArchive'),
    };

    validateInputs(inputs);
    await setupBoringCache();

    const config = await getCacheConfig(inputs.key, inputs.enableCrossOsArchive);
    const resolvedPaths = resolvePaths(inputs.path);
    
    await saveCache(config.workspace, resolvedPaths, config.fullKey);

  } catch (error) {
    core.setFailed(`Cache save failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function saveCache(workspace: string, paths: string, key: string): Promise<void> {
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
    const result = await exec.exec('boringcache', [
      'save',
      workspace,
      `${key}:${cachePath}`
    ], { ignoreReturnCode: true });

    if (result === 0) {
      core.info(`✅ Saved: ${cachePath}`);
    } else {
      core.warning(`⚠️ Failed to save: ${cachePath}`);
    }
  }
}

run();