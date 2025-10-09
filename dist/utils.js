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
            // Use bash installer through Git Bash (available on Windows runners)
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
            // Add Windows installation paths (CLI installs to .local/bin on Windows)
            const homeDir = os.homedir();
            core.addPath(`${homeDir}/.local/bin`);
            core.addPath('/home/runneradmin/.local/bin');
            core.addPath(`${homeDir}\\.boringcache\\bin`);
            core.addPath('C:\\Users\\runneradmin\\.boringcache\\bin');
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
            // Add common BoringCache installation paths for Linux/macOS
            core.addPath(`${homeDir}/.boringcache/bin`);
            core.addPath(`${homeDir}/.local/bin`);
            core.addPath('/usr/local/bin');
            core.addPath('/home/runner/.boringcache/bin');
            core.addPath('/home/runner/.local/bin');
            // Also set PATH environment variable directly
            const currentPath = process.env.PATH || '';
            const newPaths = [
                `${homeDir}/.boringcache/bin`,
                `${homeDir}/.local/bin`,
                '/usr/local/bin',
                '/home/runner/.boringcache/bin',
                '/home/runner/.local/bin'
            ];
            const updatedPath = newPaths.join(':') + ':' + currentPath;
            core.exportVariable('PATH', updatedPath);
        }
        // Verify installation
        try {
            await exec.exec('boringcache', ['--version'], {
                ignoreReturnCode: true,
                silent: true
            });
            core.info('✅ BoringCache CLI installed and verified successfully');
        }
        catch (verifyError) {
            // Try with explicit path
            const homeDir = os.homedir();
            const possiblePaths = [
                `${homeDir}/.boringcache/bin/boringcache`,
                `${homeDir}/.local/bin/boringcache`,
                '/usr/local/bin/boringcache',
                '/home/runner/.boringcache/bin/boringcache'
            ];
            let found = false;
            for (const path of possiblePaths) {
                try {
                    await exec.exec(path, ['--version'], {
                        ignoreReturnCode: true,
                        silent: true
                    });
                    core.info(`✅ BoringCache CLI found at: ${path}`);
                    // Create symlink to /usr/local/bin if not already there
                    if (path !== '/usr/local/bin/boringcache') {
                        await exec.exec('sudo', ['ln', '-sf', path, '/usr/local/bin/boringcache'], {
                            ignoreReturnCode: true,
                            silent: true
                        });
                    }
                    found = true;
                    break;
                }
                catch {
                    continue;
                }
            }
            if (!found) {
                throw new Error('BoringCache CLI installed but not found in PATH. Installation may have failed.');
            }
        }
    }
    catch (error) {
        throw new Error(`Failed to install BoringCache CLI: ${error}`);
    }
}
async function getCacheConfig(key, enableCrossOsArchive, noPlatform = false) {
    var _a;
    const workspace = process.env.BORINGCACHE_WORKSPACE ||
        ((_a = process.env.GITHUB_REPOSITORY) === null || _a === void 0 ? void 0 : _a.split('/')[1]) ||
        'default';
    let platformSuffix = '';
    if (!noPlatform && !enableCrossOsArchive) {
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
        // Both save and restore now use tag:path format (unified)
        // Find the first colon for the separator
        const colonIndex = entry.indexOf(':');
        if (colonIndex === -1) {
            throw new Error(`Invalid entry format: ${entry}. Expected format: tag:path`);
        }
        const parts = [entry.substring(0, colonIndex), entry.substring(colonIndex + 1)];
        // Both save and restore use tag:path format
        return { tag: parts[0], path: resolvePath(parts[1]) };
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
function getPlatformSuffix(noPlatform, enableCrossOsArchive) {
    if (noPlatform || enableCrossOsArchive) {
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
    // Handle platform suffix logic - CLI will handle this with --no-platform flag
    // For legacy compatibility in actions/cache mode, we still need to construct the key
    const shouldDisablePlatform = inputs.noPlatform || inputs.enableCrossOsArchive || false;
    const platformSuffix = getPlatformSuffix(shouldDisablePlatform, inputs.enableCrossOsArchive);
    const fullKey = inputs.key + platformSuffix;
    // Both save and restore now use tag:path format (unified)
    return paths.map((p) => `${fullKey}:${resolvePath(p)}`).join(',');
}
