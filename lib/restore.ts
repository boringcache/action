import * as core from '@actions/core';
import { ensureBoringCache, validateInputs, parseEntries, getPlatformSuffix, getWorkspace, convertCacheFormatToEntries, execBoringCache } from './utils';

export async function run(): Promise<void> {
  try {
    const cliVersion = core.getInput('cli-version') || 'v1.0.1';
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
      force: core.getBooleanInput('force'),
      exclude: core.getInput('exclude'),
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

    core.saveState('cache-entries', saveEntries);
    core.saveState('cache-entries-restore', restoreEntries);
    core.saveState('cache-workspace', workspace);
    core.saveState('cache-exclude', inputs.exclude);
    core.saveState('cli-version', cliVersion);
    core.saveState('no-platform', String(inputs.noPlatform));
    core.saveState('enableCrossOsArchive', String(inputs.enableCrossOsArchive));
    core.saveState('force', String(inputs.force));
    core.saveState('verbose', String(inputs.verbose));

  } catch (error) {
    core.setFailed(`Cache restore failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

run();
