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
const utils_1 = require("./utils");
async function run() {
    try {
        const cliVersion = core.getInput('cli-version') || 'v1.0.0';
        const inputs = {
            path: core.getInput('path', { required: true }),
            key: core.getInput('key', { required: true }),
            restoreKeys: core.getInput('restore-keys'),
            enableCrossOsArchive: core.getBooleanInput('enableCrossOsArchive'),
            noPlatform: core.getBooleanInput('no-platform'),
            failOnCacheMiss: core.getBooleanInput('fail-on-cache-miss'),
            lookupOnly: core.getBooleanInput('lookup-only'),
            verbose: core.getBooleanInput('verbose'),
        };
        (0, utils_1.validateInputs)(inputs);
        await (0, utils_1.ensureBoringCache)({ version: cliVersion });
        const config = await (0, utils_1.getCacheConfig)(inputs.key, inputs.enableCrossOsArchive, inputs.noPlatform);
        const resolvedPaths = (0, utils_1.resolvePaths)(inputs.path);
        const pathList = resolvedPaths.split('\n').filter(p => p);
        const targetPath = pathList[0];
        let cacheHit = false;
        let matchedKey = '';
        core.info(`🔍 Restoring cache: ${config.fullKey} → ${targetPath}`);
        const args = ['restore', config.workspace, `${config.fullKey}:${targetPath}`];
        // Translate enableCrossOsArchive to --no-platform
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
        let lastExitCode = await (0, utils_1.execBoringCache)(args, { ignoreReturnCode: true });
        if (lastExitCode === 0) {
            cacheHit = true;
            matchedKey = config.fullKey;
            core.info('✅ Cache hit with primary key');
        }
        else {
            if (inputs.restoreKeys) {
                const restoreKeysList = inputs.restoreKeys.split('\n').map(k => k.trim()).filter(k => k);
                const suffix = config.platformSuffix || '';
                for (const restoreKey of restoreKeysList) {
                    let candidateKey = restoreKey;
                    if (suffix && !restoreKey.endsWith(suffix)) {
                        candidateKey = `${restoreKey}${suffix}`;
                    }
                    const restoreArgs = ['restore', config.workspace, `${candidateKey}:${targetPath}`];
                    // Translate enableCrossOsArchive to --no-platform
                    if (inputs.enableCrossOsArchive || inputs.noPlatform) {
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
                    lastExitCode = await (0, utils_1.execBoringCache)(restoreArgs, { ignoreReturnCode: true });
                    if (lastExitCode === 0) {
                        cacheHit = true;
                        matchedKey = candidateKey;
                        core.info(`✅ Cache hit with restore key: ${candidateKey}`);
                        break;
                    }
                }
            }
        }
        // Note: --fail-on-cache-miss is now handled by CLI itself
        // CLI will exit with non-zero status if cache miss occurs and flag is set
        // The exec.exec with ignoreReturnCode will capture the exit code
        if (!cacheHit) {
            const missMessage = `Cache restore miss for key ${config.fullKey}`;
            if (inputs.failOnCacheMiss) {
                core.setFailed(missMessage);
                return;
            }
            core.info(`⚠️ ${missMessage}`);
        }
        core.setOutput('cache-hit', cacheHit.toString());
        core.setOutput('cache-primary-key', config.fullKey);
        core.setOutput('cache-matched-key', matchedKey);
    }
    catch (error) {
        core.setFailed(`Cache restore failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
run();
