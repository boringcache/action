import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import { setupBoringCache, validateInputs, parseEntries, getWorkspace, convertCacheFormatToEntries, execBoringCache } from './utils';

async function run(): Promise<void> {
  try {

    const cacheEntries = core.getState('cache-entries');
    const workspace = core.getState('cache-workspace');
    const exclude = core.getState('cache-exclude');

    if (cacheEntries && workspace) {
      // Post-job save
      await setupBoringCache();
      await saveCache(workspace, cacheEntries, false, false, false, false, exclude);
    } else {

      const inputs = {
        workspace: core.getInput('workspace'),
        entries: core.getInput('entries'),
        path: core.getInput('path'),
        key: core.getInput('key'),
        // GitHub Actions specific features (handled at action level)
        enableCrossOsArchive: core.getBooleanInput('enableCrossOsArchive'),
        uploadChunkSize: core.getInput('upload-chunk-size'),
        // CLI flags (passed directly to CLI)
        noPlatform: core.getBooleanInput('no-platform'),
        force: core.getBooleanInput('force'),
        verbose: core.getBooleanInput('verbose'),
        exclude: core.getInput('exclude'),
      };

      validateInputs(inputs);
      await setupBoringCache();
      
      const workspace = getWorkspace(inputs);
      

      let entriesString: string;
      if (inputs.entries) {
        // CLI format entries use tag:path format (unified)
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
  const entryList = parseEntries(entries, 'save');
  const validEntries: Array<{savePath: string, tag: string}> = [];
  const missingPaths: string[] = [];
  

  for (const entry of entryList) {
    try {
      await fs.promises.access(entry.savePath);
      validEntries.push({ savePath: entry.savePath, tag: entry.tag });
      core.debug(`✅ Path exists for save: ${entry.savePath}`);
    } catch {
      missingPaths.push(entry.savePath);
      core.debug(`❌ Save path not found: ${entry.savePath}`);
    }
  }

  if (missingPaths.length > 0) {
    core.warning(`Some cache paths do not exist: ${missingPaths.join(', ')}`);
  }

  if (validEntries.length === 0) {
    core.warning('No valid cache paths found, skipping save');
    return;
  }
  // Use unified tag:path format for save locations
  const formattedEntries = validEntries.map(e => `${e.tag}:${e.savePath}`).join(',');
  core.info(`💾 Saving cache entries: ${formattedEntries}`);

    // Handle GitHub Actions-specific features by translating to CLI equivalents
    // enableCrossOsArchive maps to --no-platform CLI flag (both disable platform suffixes)
    
    // Build CLI command with supported flags
    const args = ['save', workspace, formattedEntries];
    if (force) {
      args.push('--force');
    }
    // Translate enableCrossOsArchive to --no-platform, or use explicit no-platform setting
    if (enableCrossOsArchive || noPlatform) {
      args.push('--no-platform');
    }
    if (verbose) {
      args.push('--verbose');
    }
    if (exclude) {
      args.push('--exclude', exclude);
    }

    const result = await execBoringCache(args, { ignoreReturnCode: true });

  if (result === 0) {
    core.info(`✅ Successfully saved ${validEntries.length} cache entries`);
  } else {
    core.warning(`⚠️ Failed to save cache entries`);
  }
}

run();
