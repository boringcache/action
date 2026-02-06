import * as core from '@actions/core';
import { ensureBoringCache, getCacheConfig, validateInputs, resolvePaths, execBoringCache } from './utils';

async function run(): Promise<void> {
  try {
    const cliVersion = core.getInput('cli-version') || 'v1.0.0';
    const inputs = {
      path: core.getInput('path', { required: true }),
      key: core.getInput('key', { required: true }),
      enableCrossOsArchive: core.getBooleanInput('enableCrossOsArchive'),
      noPlatform: core.getBooleanInput('no-platform'),
      force: core.getBooleanInput('force'),
      verbose: core.getBooleanInput('verbose'),
      exclude: core.getInput('exclude'),
    };

    validateInputs(inputs);
    await ensureBoringCache({ version: cliVersion });

    const config = await getCacheConfig(inputs.key, inputs.enableCrossOsArchive, inputs.noPlatform);
    const resolvedPaths = resolvePaths(inputs.path);
    const pathList = resolvedPaths.split('\n').map(p => p.trim()).filter(p => p);
    const entries = pathList.map(p => `${config.fullKey}:${p}`).join(',');

    const args = ['save', config.workspace, entries];
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
