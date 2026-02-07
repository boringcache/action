import * as core from '@actions/core';
import { ensureBoringCache, validateInputs, parseEntries, getWorkspace, convertCacheFormatToEntries, execBoringCache } from './utils';

export async function run(): Promise<void> {
  try {
    const cacheEntries = core.getState('cache-entries');
    const workspace = core.getState('cache-workspace');
    const exclude = core.getState('cache-exclude');
    const cliVersionState = core.getState('cli-version');
    const noPlatform = core.getState('no-platform') === 'true';
    const enableCrossOsArchive = core.getState('enableCrossOsArchive') === 'true';
    const force = core.getState('force') === 'true';
    const verbose = core.getState('verbose') === 'true';

    if (cacheEntries && workspace) {
      await ensureBoringCache({ version: cliVersionState || 'v1.0.0' });
      await saveCache(workspace, cacheEntries, force, noPlatform, verbose, enableCrossOsArchive, exclude);
    } else {
      const cliVersion = core.getInput('cli-version') || 'v1.0.0';
      const inputs = {
        workspace: core.getInput('workspace'),
        entries: core.getInput('entries'),
        path: core.getInput('path'),
        key: core.getInput('key'),
        enableCrossOsArchive: core.getBooleanInput('enableCrossOsArchive'),
        uploadChunkSize: core.getInput('upload-chunk-size'),
        noPlatform: core.getBooleanInput('no-platform'),
        force: core.getBooleanInput('force'),
        verbose: core.getBooleanInput('verbose'),
        exclude: core.getInput('exclude'),
      };

      validateInputs(inputs);
      await ensureBoringCache({ version: cliVersion });

      const workspace = getWorkspace(inputs);

      let entriesString: string;
      if (inputs.entries) {
        entriesString = inputs.entries;
      } else {
        entriesString = convertCacheFormatToEntries(inputs, 'save');
      }

      await saveCache(workspace, entriesString, inputs.force, inputs.noPlatform, inputs.verbose, inputs.enableCrossOsArchive, inputs.exclude);
    }

  } catch (error) {
    core.setFailed(`Cache save failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function saveCache(workspace: string, entries: string, force: boolean = false, noPlatform: boolean = false, verbose: boolean = false, enableCrossOsArchive: boolean = false, exclude: string = ''): Promise<void> {
  const args = ['save', workspace, entries];
  if (force) {
    args.push('--force');
  }
  if (enableCrossOsArchive || noPlatform) {
    args.push('--no-platform');
  }
  if (verbose) {
    args.push('--verbose');
  }
  if (exclude) {
    args.push('--exclude', exclude);
  }

  await execBoringCache(args);
}

run();
