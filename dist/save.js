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
        const cacheEntries = core.getState('cache-entries');
        const workspace = core.getState('cache-workspace');
        const exclude = core.getState('cache-exclude');
        const cliVersionState = core.getState('cli-version');
        const noPlatform = core.getState('no-platform') === 'true';
        const enableCrossOsArchive = core.getState('enableCrossOsArchive') === 'true';
        const force = core.getState('force') === 'true';
        const verbose = core.getState('verbose') === 'true';
        if (cacheEntries && workspace) {
            await (0, utils_1.ensureBoringCache)({ version: cliVersionState || 'v1.0.3' });
            await saveCache(workspace, cacheEntries, force, noPlatform, verbose, enableCrossOsArchive, exclude);
        }
        else {
            const cliVersion = core.getInput('cli-version') || 'v1.0.3';
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
            (0, utils_1.validateInputs)(inputs);
            await (0, utils_1.ensureBoringCache)({ version: cliVersion });
            const workspace = (0, utils_1.getWorkspace)(inputs);
            let entriesString;
            if (inputs.entries) {
                entriesString = inputs.entries;
            }
            else {
                entriesString = (0, utils_1.convertCacheFormatToEntries)(inputs, 'save');
            }
            await saveCache(workspace, entriesString, inputs.force, inputs.noPlatform, inputs.verbose, inputs.enableCrossOsArchive, inputs.exclude);
        }
    }
    catch (error) {
        core.setFailed(`Cache save failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function saveCache(workspace, entries, force = false, noPlatform = false, verbose = false, enableCrossOsArchive = false, exclude = '') {
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
    await (0, utils_1.execBoringCache)(args);
}
run();
