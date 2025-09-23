"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const fs = __importStar(require("fs"));
const utils_1 = require("./utils");
async function run() {
    try {
        const cacheEntries = core.getState('cache-entries');
        const workspace = core.getState('cache-workspace');
        if (cacheEntries && workspace) {
            // Post-job save
            await (0, utils_1.setupBoringCache)();
            await saveCache(workspace, cacheEntries);
        }
        else {
            const inputs = {
                workspace: core.getInput('workspace'),
                entries: core.getInput('entries'),
                path: core.getInput('path'),
                key: core.getInput('key'),
                enableCrossOsArchive: core.getBooleanInput('enableCrossOsArchive'),
                enablePlatformSuffix: core.getBooleanInput('enable-platform-suffix'),
            };
            (0, utils_1.validateInputs)(inputs);
            await (0, utils_1.setupBoringCache)();
            const workspace = (0, utils_1.getWorkspace)(inputs);
            let entriesString;
            if (inputs.entries) {
                // CLI format entries are in restore format (tag:path), convert to save format (path:tag)
                const restoreEntries = (0, utils_1.parseEntries)(inputs.entries, 'restore');
                entriesString = restoreEntries.map(e => `${e.path}:${e.tag}`).join(',');
            }
            else {
                entriesString = (0, utils_1.convertCacheFormatToEntries)(inputs, 'save');
            }
            await saveCache(workspace, entriesString);
        }
    }
    catch (error) {
        core.setFailed(`Cache save failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function saveCache(workspace, entries) {
    const entryList = (0, utils_1.parseEntries)(entries, 'save');
    const validEntries = [];
    const missingPaths = [];
    for (const entry of entryList) {
        try {
            await fs.promises.access(entry.path);
            validEntries.push(entry);
            core.debug(`✅ Path exists: ${entry.path}`);
        }
        catch {
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
    }
    else {
        core.warning(`⚠️ Failed to save cache entries`);
    }
}
run();
