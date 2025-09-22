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
exports.setupBoringCache = setupBoringCache;
exports.getCacheConfig = getCacheConfig;
exports.validateInputs = validateInputs;
exports.resolvePaths = resolvePaths;
exports.parseEntries = parseEntries;
exports.resolvePath = resolvePath;
exports.getPlatformSuffix = getPlatformSuffix;
exports.getWorkspace = getWorkspace;
exports.convertCacheFormatToEntries = convertCacheFormatToEntries;
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
async function setupBoringCache() {
    try {
        const result = await exec.exec('boringcache', ['--version'], {
            ignoreReturnCode: true,
            silent: true
        });
        if (result === 0) {
            core.debug('BoringCache CLI already available');
        }
        else {
            await downloadAndInstallCLI();
        }
    }
    catch (error) {
        await downloadAndInstallCLI();
    }
    const token = process.env.BORINGCACHE_API_TOKEN;
    if (token) {
        try {
            await exec.exec('boringcache', ['auth', '--token', token], { silent: true });
            core.debug('✅ BoringCache authenticated');
        }
        catch (error) {
            core.warning(`Authentication failed: ${error}`);
        }
    }
}
async function downloadAndInstallCLI() {
    core.info('📥 Installing BoringCache CLI using official installer...');
    try {
        if (os.platform() === 'win32') {
            await exec.exec('powershell', ['-Command', 'irm https://install.boringcache.com/install.ps1 | iex'], {
                listeners: {
                    stdout: (data) => {
                        core.info(data.toString());
                    },
                    stderr: (data) => {
                        core.info(data.toString());
                    }
                }
            });
            core.addPath('C:\\Users\\runneradmin\\.boringcache\\bin');
            core.exportVariable('PATH', `C:\\Users\\runneradmin\\.boringcache\\bin;${process.env.PATH}`);
        }
        else {
            await exec.exec('bash', ['-c', 'curl -sSL https://install.boringcache.com/install.sh | sh'], {
                listeners: {
                    stdout: (data) => {
                        core.info(data.toString());
                    },
                    stderr: (data) => {
                        core.info(data.toString());
                    }
                }
            });
            const homeDir = os.homedir();
            core.addPath(`${homeDir}/.boringcache/bin`);
        }
        core.info('✅ BoringCache CLI installed successfully');
    }
    catch (error) {
        throw new Error(`Failed to install BoringCache CLI: ${error}`);
    }
}
async function getCacheConfig(key, enableCrossOsArchive, enablePlatformSuffix = false) {
    var _a;
    const workspace = process.env.BORINGCACHE_WORKSPACE ||
        ((_a = process.env.GITHUB_REPOSITORY) === null || _a === void 0 ? void 0 : _a.split('/')[1]) ||
        'default';
    let platformSuffix = '';
    if (enablePlatformSuffix && !enableCrossOsArchive) {
        const platform = os.platform() === 'darwin' ? 'darwin' : 'linux';
        const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64';
        platformSuffix = `-${platform}-${arch}`;
    }
    const fullKey = key + platformSuffix;
    return {
        workspace,
        fullKey,
        platformSuffix
    };
}
function validateInputs(inputs) {
    const hasCliFormat = inputs.workspace || inputs.entries;
    const hasCacheFormat = inputs.path || inputs.key;
    if (!hasCliFormat && !hasCacheFormat) {
        throw new Error('Either (workspace + entries) or (path + key) inputs are required');
    }
    if (hasCliFormat && hasCacheFormat) {
        core.warning('Both CLI format (workspace/entries) and actions/cache format (path/key) provided. Using CLI format.');
    }
    if (hasCliFormat) {
        if (!inputs.entries) {
            throw new Error('Input "entries" is required when using CLI format');
        }
    }
    if (hasCacheFormat && !hasCliFormat) {
        if (!inputs.path) {
            throw new Error('Input "path" is required when using actions/cache format');
        }
        if (!inputs.key) {
            throw new Error('Input "key" is required when using actions/cache format');
        }
    }
    if (inputs.workspace && !inputs.workspace.includes('/')) {
        throw new Error('Workspace must be in format "namespace/workspace" (e.g., "my-org/my-project")');
    }
}
function resolvePaths(pathInput) {
    return pathInput.split('\n')
        .map(p => p.trim())
        .filter(p => p)
        .map(cachePath => {
        if (path.isAbsolute(cachePath)) {
            return cachePath;
        }
        if (cachePath.startsWith('~/')) {
            return path.join(os.homedir(), cachePath.slice(2));
        }
        return path.resolve(process.cwd(), cachePath);
    })
        .join('\n');
}
function parseEntries(entriesInput, action) {
    return entriesInput.split(',')
        .map(entry => entry.trim())
        .filter(entry => entry)
        .map(entry => {
        let colonIndex;
        if (action === 'save') {
            // For save format (path:tag), find the LAST colon to handle Windows paths like "C:\path:tag"
            colonIndex = entry.lastIndexOf(':');
            // Check if this is just a Windows drive letter (e.g., "C:something" with no tag)
            if (colonIndex === 1) {
                throw new Error(`Invalid entry format: ${entry}. Expected format: ${action === 'save' ? 'path:tag' : 'tag:path'}`);
            }
        }
        else {
            // For restore format (tag:path), find the first colon for the separator
            colonIndex = entry.indexOf(':');
            // Check if the path part starts with a Windows drive (e.g., "tag:C:\path")
            // If so, this is valid - the tag ends at the first colon
        }
        if (colonIndex === -1) {
            throw new Error(`Invalid entry format: ${entry}. Expected format: ${action === 'save' ? 'path:tag' : 'tag:path'}`);
        }
        const parts = [entry.substring(0, colonIndex), entry.substring(colonIndex + 1)];
        if (action === 'save') {
            return { path: resolvePath(parts[0]), tag: parts[1] };
        }
        else {
            return { tag: parts[0], path: resolvePath(parts[1]) };
        }
    });
}
function resolvePath(pathInput) {
    const trimmedPath = pathInput.trim();
    if (path.isAbsolute(trimmedPath)) {
        return trimmedPath;
    }
    if (trimmedPath.startsWith('~/')) {
        return path.join(os.homedir(), trimmedPath.slice(2));
    }
    return path.resolve(process.cwd(), trimmedPath);
}
function getPlatformSuffix(enablePlatformSuffix, enableCrossOsArchive) {
    if (!enablePlatformSuffix || enableCrossOsArchive) {
        return '';
    }
    const platform = os.platform() === 'darwin' ? 'darwin' : 'linux';
    const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64';
    return `-${platform}-${arch}`;
}
function getWorkspace(inputs) {
    if (inputs.workspace) {
        return inputs.workspace;
    }
    const repo = process.env.GITHUB_REPOSITORY;
    if (repo) {
        const parts = repo.split('/');
        return `${parts[0]}/${parts[1]}`;
    }
    return 'default/default';
}
function convertCacheFormatToEntries(inputs, action) {
    if (!inputs.path || !inputs.key) {
        throw new Error('actions/cache format requires both path and key inputs');
    }
    const paths = inputs.path.split('\n')
        .map((p) => p.trim())
        .filter((p) => p);
    const platformSuffix = getPlatformSuffix(inputs.enablePlatformSuffix, inputs.enableCrossOsArchive);
    const fullKey = inputs.key + platformSuffix;
    if (action === 'save') {
        return paths.map((p) => `${resolvePath(p)}:${fullKey}`).join(',');
    }
    else {
        return paths.map((p) => `${fullKey}:${resolvePath(p)}`).join(',');
    }
}
