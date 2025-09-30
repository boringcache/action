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
    
    // Just run restore - let CLI handle everything
    const args = ['restore', workspace, entriesString];
    if (!inputs.enablePlatformSuffix) {
      args.push('--no-platform');
    }
    
    await exec.exec('boringcache', args, { ignoreReturnCode: true });

    // Set up for post-save (both use same tag:path format now)
    core.saveState('cache-entries', entriesString);
    core.saveState('cache-workspace', workspace);

  } catch (error) {
    core.setFailed(`Cache restore failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

run();