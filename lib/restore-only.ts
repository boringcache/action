import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { setupBoringCache, getCacheConfig, validateInputs, resolvePaths } from './utils';

async function run(): Promise<void> {
  try {
    const inputs = {
      path: core.getInput('path', { required: true }),
      key: core.getInput('key', { required: true }),
      restoreKeys: core.getInput('restore-keys'),
      enableCrossOsArchive: core.getBooleanInput('enableCrossOsArchive'),
      failOnCacheMiss: core.getBooleanInput('fail-on-cache-miss'),
      lookupOnly: core.getBooleanInput('lookup-only'),
    };

    validateInputs(inputs);
    await setupBoringCache();

    const config = await getCacheConfig(inputs.key, inputs.enableCrossOsArchive);
    const resolvedPaths = resolvePaths(inputs.path);
    const pathList = resolvedPaths.split('\n').filter(p => p);
    const targetPath = pathList[0];

    let cacheHit = false;
    let matchedKey = '';

    core.info(`🔍 Restoring cache: ${config.fullKey} → ${targetPath}`);
    

    const primaryResult = await exec.exec('boringcache', [
      'restore',
      config.workspace,
      `${config.fullKey}:${targetPath}`
    ], { ignoreReturnCode: true });

    if (primaryResult === 0) {
      cacheHit = true;
      matchedKey = config.fullKey;
      core.info('✅ Cache hit with primary key');
    } else {

      if (inputs.restoreKeys) {
        const restoreKeysList = inputs.restoreKeys.split('\n').map(k => k.trim()).filter(k => k);
        
        for (const restoreKey of restoreKeysList) {
          const result = await exec.exec('boringcache', [
            'restore',
            config.workspace,
            `${restoreKey}:${targetPath}`
          ], { ignoreReturnCode: true });

          if (result === 0) {
            cacheHit = true;
            matchedKey = restoreKey;
            core.info(`✅ Cache hit with restore key: ${restoreKey}`);
            break;
          }
        }
      }
    }

    if (inputs.failOnCacheMiss && !cacheHit) {
      core.setFailed('Cache miss and fail-on-cache-miss is enabled');
      return;
    }

    core.setOutput('cache-hit', cacheHit.toString());
    core.setOutput('cache-primary-key', config.fullKey);
    core.setOutput('cache-matched-key', matchedKey);

  } catch (error) {
    core.setFailed(`Cache restore failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

run();