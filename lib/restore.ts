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
      // GitHub Actions specific features (handled at action level)
      enableCrossOsArchive: core.getBooleanInput('enableCrossOsArchive'),
      // CLI flags (passed directly to CLI)
      noPlatform: core.getBooleanInput('no-platform'),
      failOnCacheMiss: core.getBooleanInput('fail-on-cache-miss'),
      lookupOnly: core.getBooleanInput('lookup-only'),
      verbose: core.getBooleanInput('verbose'),
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
    
    // Handle GitHub Actions-specific features that don't exist in CLI
    if (inputs.lookupOnly) {
      core.info('🔍 Lookup-only mode enabled');
    }

    // Run restore with CLI-supported flags
    const args = ['restore', workspace, entriesString];
    // Translate enableCrossOsArchive to --no-platform, or use explicit no-platform setting
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
    
    const result = await exec.exec('boringcache', args, { ignoreReturnCode: true });

    // Note: --fail-on-cache-miss is now handled by CLI itself
    // CLI will exit with non-zero status if cache miss occurs and flag is set

    // Set up for post-save (both use same tag:path format now)
    core.saveState('cache-entries', entriesString);
    core.saveState('cache-workspace', workspace);

  } catch (error) {
    core.setFailed(`Cache restore failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

run();