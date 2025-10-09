import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { setupBoringCache, getCacheConfig, validateInputs, resolvePaths } from './utils';

async function run(): Promise<void> {
  try {
    const inputs = {
      path: core.getInput('path', { required: true }),
      key: core.getInput('key', { required: true }),
      restoreKeys: core.getInput('restore-keys'),
      // GitHub Actions specific features
      enableCrossOsArchive: core.getBooleanInput('enableCrossOsArchive'),
      // CLI flags
      noPlatform: core.getBooleanInput('no-platform'),
      failOnCacheMiss: core.getBooleanInput('fail-on-cache-miss'),
      lookupOnly: core.getBooleanInput('lookup-only'),
      verbose: core.getBooleanInput('verbose'),
    };

    validateInputs(inputs);
    await setupBoringCache();

    const config = await getCacheConfig(inputs.key, inputs.enableCrossOsArchive, inputs.noPlatform);
    const resolvedPaths = resolvePaths(inputs.path);
    const pathList = resolvedPaths.split('\n').filter(p => p);
    const targetPath = pathList[0];

    let cacheHit = false;
    let matchedKey = '';

    core.info(`🔍 Restoring cache: ${config.fullKey} → ${targetPath}`);
    

    const args = ['restore', config.workspace, `${config.fullKey}:${targetPath}`];
    // Translate enableCrossOsArchive to --no-platform
    if (inputs.enableCrossOsArchive || inputs.noPlatform) {
      args.push('--no-platform');
    }
    if (inputs.failOnCacheMiss) {
      args.push('--fail-on-cache-miss');
    }
    if (inputs.lookupOnly) {
      args.push('--lookup-only');
    }
    if (inputs.verbose) {
      args.push('--verbose');
    }
    const primaryResult = await exec.exec('boringcache', args, { ignoreReturnCode: true });

    if (primaryResult === 0) {
      cacheHit = true;
      matchedKey = config.fullKey;
      core.info('✅ Cache hit with primary key');
    } else {

      if (inputs.restoreKeys) {
        const restoreKeysList = inputs.restoreKeys.split('\n').map(k => k.trim()).filter(k => k);
        
        for (const restoreKey of restoreKeysList) {
          const restoreArgs = ['restore', config.workspace, `${restoreKey}:${targetPath}`];
          // Translate enableCrossOsArchive to --no-platform
          if (inputs.enableCrossOsArchive || inputs.noPlatform) {
            restoreArgs.push('--no-platform');
          }
          if (inputs.failOnCacheMiss) {
            restoreArgs.push('--fail-on-cache-miss');
          }
          if (inputs.lookupOnly) {
            restoreArgs.push('--lookup-only');
          }
          if (inputs.verbose) {
            restoreArgs.push('--verbose');
          }
          const result = await exec.exec('boringcache', restoreArgs, { ignoreReturnCode: true });

          if (result === 0) {
            cacheHit = true;
            matchedKey = restoreKey;
            core.info(`✅ Cache hit with restore key: ${restoreKey}`);
            break;
          }
        }
      }
    }

    // Note: --fail-on-cache-miss is now handled by CLI itself
    // CLI will exit with non-zero status if cache miss occurs and flag is set
    // The exec.exec with ignoreReturnCode will capture the exit code

    core.setOutput('cache-hit', cacheHit.toString());
    core.setOutput('cache-primary-key', config.fullKey);
    core.setOutput('cache-matched-key', matchedKey);

  } catch (error) {
    core.setFailed(`Cache restore failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

run();