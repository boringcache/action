import * as core from '@actions/core';
import { ensureBoringCache, execBoringCache, validateInputs, parseEntries, getPlatformSuffix, getWorkspace, convertCacheFormatToEntries } from './utils';

export async function run(): Promise<void> {
  try {
    const cliVersion = core.getInput('cli-version') || 'v1.2.0';
    const inputs = {
      workspace: core.getInput('workspace'),
      entries: core.getInput('entries'),
      path: core.getInput('path'),
      key: core.getInput('key'),
      restoreKeys: core.getInput('restore-keys'),
      enableCrossOsArchive: core.getBooleanInput('enableCrossOsArchive'),
      noPlatform: core.getBooleanInput('no-platform'),
      failOnCacheMiss: core.getBooleanInput('fail-on-cache-miss'),
      lookupOnly: core.getBooleanInput('lookup-only'),
      verbose: core.getBooleanInput('verbose'),
    };

    validateInputs(inputs);
    await ensureBoringCache({ version: cliVersion });

    const workspace = getWorkspace(inputs);

    let entriesString: string;
    if (inputs.entries) {
      entriesString = inputs.entries;
    } else {
      entriesString = convertCacheFormatToEntries(inputs, 'restore');
    }

    const entries = parseEntries(entriesString, 'restore');
    const shouldDisablePlatform = inputs.enableCrossOsArchive || inputs.noPlatform;

    let cacheHit = false;
    let primaryKey = '';
    let matchedKey = '';

    core.info(`Attempting to restore cache entries: ${entriesString}`);

    const restoreArgs = ['restore', workspace, entriesString];
    if (shouldDisablePlatform) {
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

    const primaryResult = await execBoringCache(restoreArgs, { ignoreReturnCode: true });

    if (primaryResult === 0) {
      core.info('Cache hit with primary entries');
      cacheHit = true;
      primaryKey = entries.map(e => e.tag).join(',');
      matchedKey = primaryKey;
    } else {
      core.info('Cache miss with primary entries');

      if (inputs.restoreKeys) {
        core.info('Trying restore keys...');
        const restoreKeysList = inputs.restoreKeys.split('\n').map(k => k.trim()).filter(k => k);

        for (const restoreKey of restoreKeysList) {
          const platformSuffix = getPlatformSuffix(shouldDisablePlatform, inputs.enableCrossOsArchive);
          const fullRestoreKey = restoreKey + platformSuffix;

          const fallbackEntry = `${fullRestoreKey}:${entries[0].restorePath}`;

          core.info(`Attempting restore key: ${fallbackEntry}`);
          const fallbackArgs = ['restore', workspace, fallbackEntry];
          if (shouldDisablePlatform) {
            fallbackArgs.push('--no-platform');
          }
          if (inputs.failOnCacheMiss) {
            fallbackArgs.push('--fail-on-cache-miss');
          }
          if (inputs.lookupOnly) {
            fallbackArgs.push('--lookup-only');
          }
          if (inputs.verbose) {
            fallbackArgs.push('--verbose');
          }

          const restoreResult = await execBoringCache(fallbackArgs, { ignoreReturnCode: true });

          if (restoreResult === 0) {
            core.info(`Cache hit with restore key: ${fullRestoreKey}`);
            cacheHit = true;
            matchedKey = fullRestoreKey;
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
    core.setOutput('cache-primary-key', primaryKey);
    core.setOutput('cache-matched-key', matchedKey);

  } catch (error) {
    core.setFailed(`Cache restore failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

run();
