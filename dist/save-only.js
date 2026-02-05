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
const fs = __importStar(require("fs"));
const utils_1 = require("./utils");
async function run() {
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
        (0, utils_1.validateInputs)(inputs);
        await (0, utils_1.ensureBoringCache)({ version: cliVersion });
        const config = await (0, utils_1.getCacheConfig)(inputs.key, inputs.enableCrossOsArchive, inputs.noPlatform);
        const resolvedPaths = (0, utils_1.resolvePaths)(inputs.path);
        await saveCache(config.workspace, resolvedPaths, config.fullKey, inputs.force, inputs.verbose, inputs.enableCrossOsArchive, inputs.noPlatform, inputs.exclude);
    }
    catch (error) {
        core.setFailed(`Cache save failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function saveCache(workspace, paths, key, force = false, verbose = false, enableCrossOsArchive = false, noPlatform = false, exclude = '') {
    const pathList = paths.split('\n').map(p => p.trim()).filter(p => p);
    const validPaths = [];
    for (const cachePath of pathList) {
        try {
            await fs.promises.access(cachePath);
            validPaths.push(cachePath);
        }
        catch {
            core.warning(`Path does not exist: ${cachePath}`);
        }
    }
    if (validPaths.length === 0) {
        core.warning('No valid cache paths found, skipping save');
        return;
    }
    core.info(`💾 Saving cache: ${key} ← ${validPaths.join(', ')}`);
    for (const cachePath of validPaths) {
        const args = ['save', workspace, `${key}:${cachePath}`];
        if (force) {
            args.push('--force');
        }
        // Translate enableCrossOsArchive to --no-platform
        if (enableCrossOsArchive || noPlatform) {
            args.push('--no-platform');
        }
        if (verbose) {
            args.push('--verbose');
        }
        if (exclude) {
            args.push('--exclude', exclude);
        }
        const result = await (0, utils_1.execBoringCache)(args, { ignoreReturnCode: true });
        if (result === 0) {
            core.info(`✅ Saved: ${cachePath}`);
        }
        else {
            core.warning(`⚠️ Failed to save: ${cachePath}`);
        }
    }
}
run();
