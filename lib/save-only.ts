import * as core from '@actions/core';
import { ensureBoringCache, execBoringCache, validateInputs, getWorkspace, convertCacheFormatToEntries } from './utils';

export async function run(): Promise<void> {
  try {
    const cliVersion = core.getInput('cli-version') || 'v1.0.2';
    const inputs = {
      workspace: core.getInput('workspace'),
      entries: core.getInput('entries'),
      path: core.getInput('path'),
      key: core.getInput('key'),
      enableCrossOsArchive: core.getBooleanInput('enableCrossOsArchive'),
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

    const args = ['save', workspace, entriesString];
    if (inputs.force) {
      args.push('--force');
    }
    if (inputs.enableCrossOsArchive || inputs.noPlatform) {
      args.push('--no-platform');
    }
    if (inputs.verbose) {
      args.push('--verbose');
    }
    if (inputs.exclude) {
      args.push('--exclude', inputs.exclude);
    }

    await execBoringCache(args);

  } catch (error) {
    core.setFailed(`Cache save failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

run();
