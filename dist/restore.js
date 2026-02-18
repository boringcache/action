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
    var _a, _b, _c, _d;
    try {
        const cliVersion = core.getInput('cli-version') || 'v1.0.3';
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
        // Handle GitHub Actions-specific features that don't exist in CLI
        if (inputs.lookupOnly) {
            core.info('🔍 Lookup-only mode enabled');
        }
        const parsedEntries = (0, utils_1.parseEntries)(entriesString, 'restore', { resolvePaths: false });
        if (parsedEntries.length === 0) {
            core.warning('No valid cache entries provided, skipping restore');
            return;
        }
        const restoreEntries = parsedEntries.map(entry => `${entry.tag}:${entry.restorePath}`).join(',');
        const saveEntries = parsedEntries.map(entry => `${entry.tag}:${entry.savePath}`).join(',');
        const flagArgs = [];
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
        let lastExitCode = await (0, utils_1.execBoringCache)(args, { ignoreReturnCode: true });
        const usingActionsCacheFormat = !inputs.entries;
        const primaryTag = (_a = parsedEntries[0]) === null || _a === void 0 ? void 0 : _a.tag;
        const restoreKeysRaw = (_c = (_b = inputs.restoreKeys) === null || _b === void 0 ? void 0 : _b.split('\n').map(k => k.trim()).filter(Boolean)) !== null && _c !== void 0 ? _c : [];
        if (lastExitCode !== 0 && usingActionsCacheFormat && restoreKeysRaw.length > 0) {
            const suffix = (0, utils_1.getPlatformSuffix)(inputs.noPlatform, inputs.enableCrossOsArchive);
            const buildEntriesForKey = (key) => parsedEntries.map(entry => `${key}:${entry.restorePath}`).join(',');
            for (const restoreKey of restoreKeysRaw) {
                let candidateKey = restoreKey;
                if (suffix && !restoreKey.endsWith(suffix)) {
                    candidateKey = `${restoreKey}${suffix}`;
                }
                const fallbackArgs = ['restore', workspace, buildEntriesForKey(candidateKey), ...flagArgs];
                lastExitCode = await (0, utils_1.execBoringCache)(fallbackArgs, { ignoreReturnCode: true });
                if (lastExitCode === 0) {
                    core.info(`✅ Cache hit with restore key: ${candidateKey}`);
                    break;
                }
            }
        }
        if (lastExitCode !== 0) {
            const missKey = usingActionsCacheFormat ? (_d = primaryTag !== null && primaryTag !== void 0 ? primaryTag : inputs.key) !== null && _d !== void 0 ? _d : 'unknown' : 'provided entries';
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
    }
    catch (error) {
        core.setFailed(`Cache restore failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
run();
