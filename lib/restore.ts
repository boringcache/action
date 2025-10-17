import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { setupBoringCache, validateInputs, parseEntries, getPlatformSuffix, getWorkspace, convertCacheFormatToEntries, execBoringCache } from './utils';

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

    const parsedEntries = parseEntries(entriesString, 'restore', { resolvePaths: false });
    if (parsedEntries.length === 0) {
      core.warning('No valid cache entries provided, skipping restore');
      return;
    }

    const restoreEntries = parsedEntries.map(entry => `${entry.tag}:${entry.restorePath}`).join(',');
    const saveEntries = parsedEntries.map(entry => `${entry.tag}:${entry.savePath}`).join(',');

    const flagArgs: string[] = [];
    if (inputs.enableCrossOsArchive || inputs.noPlatform) {
      flagArgs.push('--no-platform');
    }
    if (inputs.failOnCacheMiss) {
      flagArgs.push('--fail-on-cache-miss');
    }
    if (inputs.lookupOnly) {
      flagArgs.push('--lookup-only');
    }
    if (inputs.verbose) {
      flagArgs.push('--verbose');
    }

    // Run restore with CLI-supported flags
    const args = ['restore', workspace, restoreEntries, ...flagArgs];
    let lastExitCode = await execBoringCache(args, { ignoreReturnCode: true });

    const usingActionsCacheFormat = !inputs.entries;
    const primaryTag = parsedEntries[0]?.tag;
    const restoreKeysRaw = inputs.restoreKeys?.split('\n').map(k => k.trim()).filter(Boolean) ?? [];
    if (lastExitCode !== 0 && usingActionsCacheFormat && restoreKeysRaw.length > 0) {
      const suffix = getPlatformSuffix(inputs.noPlatform, inputs.enableCrossOsArchive);
      const buildEntriesForKey = (key: string): string =>
        parsedEntries.map(entry => `${key}:${entry.restorePath}`).join(',');

      for (const restoreKey of restoreKeysRaw) {
        let candidateKey = restoreKey;
        if (suffix && !restoreKey.endsWith(suffix)) {
          candidateKey = `${restoreKey}${suffix}`;
        }
        const fallbackArgs = ['restore', workspace, buildEntriesForKey(candidateKey), ...flagArgs];
        lastExitCode = await execBoringCache(fallbackArgs, { ignoreReturnCode: true });
        if (lastExitCode === 0) {
          core.info(`✅ Cache hit with restore key: ${candidateKey}`);
          break;
        }
      }
    }

    if (lastExitCode !== 0) {
      const missKey = usingActionsCacheFormat ? primaryTag ?? inputs.key ?? 'unknown' : 'provided entries';
      const missMessage = `Cache restore miss for key ${missKey}`;
      if (inputs.failOnCacheMiss) {
        core.setFailed(missMessage);
        return;
      }
      core.warning(missMessage);
    }

    // Set up for post-save (use save paths for post job)
    core.saveState('cache-entries', saveEntries);
    core.saveState('cache-entries-restore', restoreEntries);
    core.saveState('cache-workspace', workspace);

  } catch (error) {
    core.setFailed(`Cache restore failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

run();
