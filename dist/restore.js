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
const exec = __importStar(require("@actions/exec"));
const utils_1 = require("./utils");
async function run() {
    try {
        const inputs = {
            workspace: core.getInput('workspace'),
            entries: core.getInput('entries'),
            path: core.getInput('path'),
            key: core.getInput('key'),
            restoreKeys: core.getInput('restore-keys'),
            // GitHub Actions specific features (handled at action level)
            enableCrossOsArchive: core.getBooleanInput('enableCrossOsArchive'),
            // CLI flags (passed directly to CLI)
            noPlatform: core.getBooleanInput('no-platform'),
            failOnCacheMiss: core.getBooleanInput('fail-on-cache-miss'),
            lookupOnly: core.getBooleanInput('lookup-only'),
            verbose: core.getBooleanInput('verbose'),
        };
        (0, utils_1.validateInputs)(inputs);
        await (0, utils_1.setupBoringCache)();
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
        // Run restore with CLI-supported flags
        const args = ['restore', workspace, entriesString];
        // Translate enableCrossOsArchive to --no-platform, or use explicit no-platform setting
        if (inputs.enableCrossOsArchive || inputs.noPlatform) {
            args.push('--no-platform');
        }
        if (inputs.failOnCacheMiss) {
            args.push('--fail-on-cache-miss');
        }
        if (inputs.lookupOnly) {
            args.push('--lookup-only');
        }
        if (inputs.verbose) {
            args.push('--verbose');
        }
        const result = await exec.exec('boringcache', args, { ignoreReturnCode: true });
        // Note: --fail-on-cache-miss is now handled by CLI itself
        // CLI will exit with non-zero status if cache miss occurs and flag is set
        // Set up for post-save (both use same tag:path format now)
        core.saveState('cache-entries', entriesString);
        core.saveState('cache-workspace', workspace);
    }
    catch (error) {
        core.setFailed(`Cache restore failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
run();
