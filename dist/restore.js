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
            enableCrossOsArchive: core.getBooleanInput('enableCrossOsArchive'),
            enablePlatformSuffix: core.getBooleanInput('enable-platform-suffix'),
            failOnCacheMiss: core.getBooleanInput('fail-on-cache-miss'),
            lookupOnly: core.getBooleanInput('lookup-only'),
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
        // Just run restore - let CLI handle everything
        const args = ['restore', workspace, entriesString];
        if (!inputs.enablePlatformSuffix) {
            args.push('--no-platform');
        }
        await exec.exec('boringcache', args, { ignoreReturnCode: true });
        // Set up for post-save (both use same tag:path format now)
        core.saveState('cache-entries', entriesString);
        core.saveState('cache-workspace', workspace);
    }
    catch (error) {
        core.setFailed(`Cache restore failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
run();
