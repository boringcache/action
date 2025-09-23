import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import { setupBoringCache, validateInputs, parseEntries, getWorkspace, convertCacheFormatToEntries } from './utils';

async function run(): Promise<void> {
  try {

    const cacheEntries = core.getState('cache-entries');
    const workspace = core.getState('cache-workspace');
    
    if (cacheEntries && workspace) {
      // Post-job save
      await setupBoringCache();
      await saveCache(workspace, cacheEntries);
    } else {

      const inputs = {
        workspace: core.getInput('workspace'),
        entries: core.getInput('entries'),
        path: core.getInput('path'),
        key: core.getInput('key'),
        enableCrossOsArchive: core.getBooleanInput('enableCrossOsArchive'),
        enablePlatformSuffix: core.getBooleanInput('enable-platform-suffix'),
      };

      validateInputs(inputs);
      await setupBoringCache();
      
      const workspace = getWorkspace(inputs);
      

      let entriesString: string;
      if (inputs.entries) {
        // CLI format entries are in restore format (tag:path), convert to save format (path:tag)
        const restoreEntries = parseEntries(inputs.entries, 'restore');
        entriesString = restoreEntries.map(e => `${e.path}:${e.tag}`).join(',');
      } else {

        entriesString = convertCacheFormatToEntries(inputs, 'save');
      }
      
      await saveCache(workspace, entriesString);
    }

  } catch (error) {
    core.setFailed(`Cache save failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function saveCache(workspace: string, entries: string): Promise<void> {
  const entryList = parseEntries(entries, 'save');
  const validEntries: Array<{path: string, tag: string}> = [];
  const missingPaths: string[] = [];
  

  for (const entry of entryList) {
    try {
      await fs.promises.access(entry.path);
      validEntries.push(entry);
      core.debug(`✅ Path exists: ${entry.path}`);
    } catch {
      missingPaths.push(entry.path);
      core.debug(`❌ Path not found: ${entry.path}`);
    }
  }

  if (missingPaths.length > 0) {
    core.warning(`Some cache paths do not exist: ${missingPaths.join(', ')}`);
  }

  if (validEntries.length === 0) {
    core.warning('No valid cache paths found, skipping save');
    return;
  }
  const formattedEntries = validEntries.map(e => `${e.path}:${e.tag}`).join(',');
  core.info(`💾 Saving cache entries: ${formattedEntries}`);

  const result = await exec.exec('boringcache', [
    'save',
    workspace,
    formattedEntries
  ], { ignoreReturnCode: true });

  if (result === 0) {
    core.info(`✅ Successfully saved ${validEntries.length} cache entries`);
  } else {
    core.warning(`⚠️ Failed to save cache entries`);
  }
}

run();