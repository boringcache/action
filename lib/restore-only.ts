import * as core from '@actions/core';
import { ensureBoringCache, getCacheConfig, validateInputs, resolvePaths, execBoringCache } from './utils';

async function run(): Promise<void> {
  try {
    const cliVersion = core.getInput('cli-version') || 'v1.0.0';
    const inputs = {
      path: core.getInput('path', { required: true }),
      key: core.getInput('key', { required: true }),
      restoreKeys: core.getInput('restore-keys'),
      enableCrossOsArchive: core.getBooleanInput('enableCrossOsArchive'),
      noPlatform: core.getBooleanInput('no-platform'),
      failOnCacheMiss: core.getBooleanInput('fail-on-cache-miss'),
      lookupOnly: core.getBooleanInput('lookup-only'),
      verbose: core.getBooleanInput('verbose'),
    };

    validateInputs(inputs);
    await ensureBoringCache({ version: cliVersion });

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
    let lastExitCode = await execBoringCache(args, { ignoreReturnCode: true });

    if (lastExitCode === 0) {
      cacheHit = true;
      matchedKey = config.fullKey;
      core.info('✅ Cache hit with primary key');
    } else {

      if (inputs.restoreKeys) {
        const restoreKeysList = inputs.restoreKeys.split('\n').map(k => k.trim()).filter(k => k);
        const suffix = config.platformSuffix || '';
        
        for (const restoreKey of restoreKeysList) {
          let candidateKey = restoreKey;
          if (suffix && !restoreKey.endsWith(suffix)) {
            candidateKey = `${restoreKey}${suffix}`;
          }

          const restoreArgs = ['restore', config.workspace, `${candidateKey}:${targetPath}`];
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
          lastExitCode = await execBoringCache(restoreArgs, { ignoreReturnCode: true });

          if (lastExitCode === 0) {
            cacheHit = true;
            matchedKey = candidateKey;
            core.info(`✅ Cache hit with restore key: ${candidateKey}`);
            break;
          }
        }
      }
    }

    // Note: --fail-on-cache-miss is now handled by CLI itself
    // CLI will exit with non-zero status if cache miss occurs and flag is set
    // The exec.exec with ignoreReturnCode will capture the exit code

    if (!cacheHit) {
      const missMessage = `Cache restore miss for key ${config.fullKey}`;
      if (inputs.failOnCacheMiss) {
        core.setFailed(missMessage);
        return;
      }
      core.info(`⚠️ ${missMessage}`);
    }

    core.setOutput('cache-hit', cacheHit.toString());
    core.setOutput('cache-primary-key', config.fullKey);
    core.setOutput('cache-matched-key', matchedKey);

  } catch (error) {
    core.setFailed(`Cache restore failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

run();
