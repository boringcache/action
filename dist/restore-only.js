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
exports.run = run;
const core = __importStar(require("@actions/core"));
const utils_1 = require("./utils");
async function run() {
    try {
        const cliVersion = core.getInput('cli-version') || 'v1.1.1';
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
        };
        (0, utils_1.validateInputs)(inputs);
        await (0, utils_1.ensureBoringCache)({ version: cliVersion });
        const workspace = (0, utils_1.getWorkspace)(inputs);
        let entriesString;
        if (inputs.entries) {
            entriesString = inputs.entries;
        }
        else {
            entriesString = (0, utils_1.convertCacheFormatToEntries)(inputs, 'restore');
        }
        const entries = (0, utils_1.parseEntries)(entriesString, 'restore');
        const shouldDisablePlatform = inputs.enableCrossOsArchive || inputs.noPlatform;
        let cacheHit = false;
        let primaryKey = '';
        let matchedKey = '';
        core.info(`Attempting to restore cache entries: ${entriesString}`);
        const restoreArgs = ['restore', workspace, entriesString];
        if (shouldDisablePlatform) {
            restoreArgs.push('--no-platform');
        }
        if (inputs.failOnCacheMiss) {
            restoreArgs.push('--fail-on-cache-miss');
        }
        if (inputs.lookupOnly) {
            restoreArgs.push('--lookup-only');
        }
        if (inputs.verbose) {
            restoreArgs.push('--verbose');
        }
        const primaryResult = await (0, utils_1.execBoringCache)(restoreArgs, { ignoreReturnCode: true });
        if (primaryResult === 0) {
            core.info('Cache hit with primary entries');
            cacheHit = true;
            primaryKey = entries.map(e => e.tag).join(',');
            matchedKey = primaryKey;
        }
        else {
            core.info('Cache miss with primary entries');
            if (inputs.restoreKeys) {
                core.info('Trying restore keys...');
                const restoreKeysList = inputs.restoreKeys.split('\n').map(k => k.trim()).filter(k => k);
                for (const restoreKey of restoreKeysList) {
                    const platformSuffix = (0, utils_1.getPlatformSuffix)(shouldDisablePlatform, inputs.enableCrossOsArchive);
                    const fullRestoreKey = restoreKey + platformSuffix;
                    const fallbackEntry = `${fullRestoreKey}:${entries[0].restorePath}`;
                    core.info(`Attempting restore key: ${fallbackEntry}`);
                    const fallbackArgs = ['restore', workspace, fallbackEntry];
                    if (shouldDisablePlatform) {
                        fallbackArgs.push('--no-platform');
                    }
                    if (inputs.failOnCacheMiss) {
                        fallbackArgs.push('--fail-on-cache-miss');
                    }
                    if (inputs.lookupOnly) {
                        fallbackArgs.push('--lookup-only');
                    }
                    if (inputs.verbose) {
                        fallbackArgs.push('--verbose');
                    }
                    const restoreResult = await (0, utils_1.execBoringCache)(fallbackArgs, { ignoreReturnCode: true });
                    if (restoreResult === 0) {
                        core.info(`Cache hit with restore key: ${fullRestoreKey}`);
                        cacheHit = true;
                        matchedKey = fullRestoreKey;
                        break;
                    }
                }
            }
        }
        if (inputs.failOnCacheMiss && !cacheHit) {
            core.setFailed('Cache miss and fail-on-cache-miss is enabled');
            return;
        }
        core.setOutput('cache-hit', cacheHit.toString());
        core.setOutput('cache-primary-key', primaryKey);
        core.setOutput('cache-matched-key', matchedKey);
    }
    catch (error) {
        core.setFailed(`Cache restore failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
run();
