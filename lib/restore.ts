import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import { setupBoringCache, validateInputs, parseEntries, getPlatformSuffix, getWorkspace, convertCacheFormatToEntries } from './utils';

export async function run(): Promise<void> {
  try {
    const inputs = {
      workspace: core.getInput('workspace'),
      entries: core.getInput('entries'),
      path: core.getInput('path'),
      key: core.getInput('key'),
      restoreKeys: core.getInput('restore-keys'),
      enableCrossOsArchive: core.getBooleanInput('enableCrossOsArchive'),
      enablePlatformSuffix: core.getBooleanInput('enable-platform-suffix'),
      failOnCacheMiss: core.getBooleanInput('fail-on-cache-miss'),
      lookupOnly: core.getBooleanInput('lookup-only'),
    };

    validateInputs(inputs);
    await setupBoringCache();

    const workspace = getWorkspace(inputs);
    let entriesString: string;
    if (inputs.entries) {
      entriesString = inputs.entries;
    } else {
      entriesString = convertCacheFormatToEntries(inputs, 'restore');
    }
    
    const entries = parseEntries(entriesString, 'restore');
    
    let cacheHit = false;
    let primaryKey = '';
    let matchedKey = '';

    core.info(`🔍 Attempting to restore cache entries: ${entriesString}`);
    const primaryResult = await exec.exec('boringcache', [
      'restore',
      workspace,
      entriesString
    ], { ignoreReturnCode: true });

    if (primaryResult === 0) {
      core.info('✅ Cache hit with primary entries');
      cacheHit = true;
      primaryKey = entries.map(e => e.tag).join(',');
      matchedKey = primaryKey;
    } else {
      core.info('❌ Cache miss with primary entries');
      if (inputs.restoreKeys) {
        core.info('🔍 Trying restore keys...');
        const restoreKeysList = inputs.restoreKeys.split('\n').map(k => k.trim()).filter(k => k);
        
        for (const restoreKey of restoreKeysList) {
          const platformSuffix = getPlatformSuffix(inputs.enablePlatformSuffix, inputs.enableCrossOsArchive);
          const fullRestoreKey = restoreKey + platformSuffix;
          const fallbackEntry = `${fullRestoreKey}:${entries[0].path}`;
          
          core.info(`🔍 Attempting restore key: ${fallbackEntry}`);
          const restoreResult = await exec.exec('boringcache', [
            'restore',
            workspace,
            fallbackEntry
          ], { ignoreReturnCode: true });

          if (restoreResult === 0) {
            core.info(`✅ Cache hit with restore key: ${fullRestoreKey}`);
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
    if (!cacheHit && !inputs.lookupOnly) {
      const saveEntries = entries.map(e => `${e.path}:${e.tag}`).join(',');
      core.saveState('cache-entries', saveEntries);
      core.saveState('cache-workspace', workspace);
      core.saveState('cache-hit', 'false');
    }

  } catch (error) {
    core.setFailed(`Cache restore failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

run();