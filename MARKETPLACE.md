# boringcache/action

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-BoringCache-blue.svg)](https://github.com/marketplace/actions/boringcache)
[![CI](https://github.com/boringcache/action/workflows/CI/badge.svg)](https://github.com/boringcache/action/actions)

**A portable build cache for GitHub Actions.**  
Cache once, reuse anywhere — CI, deploy, or local dev.

## 🚀 Why BoringCache?

- **3x Faster** than actions/cache
- **Drop-in compatible** - same API, better performance
- **Portable caches** - reuse in CI, deploy, or local dev
- **Workspace format** - multi-cache scenarios
- **Cross-platform** - Linux, macOS, Windows
- **Smart compression** - LZ4/ZSTD auto-selection
- **Automatic setup** - no installation required

## 📦 Quick Start

### Workspace Format
```yaml
- uses: boringcache/action@v1
  with:
    workspace: my-org/my-project
    entries: "node_modules:node-deps,target:build-cache"
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

### actions/cache Compatible
```yaml
- uses: boringcache/action@v1
  with:
    path: ~/.npm
    key: ${{ runner.os }}-deps-${{ hashFiles('package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-deps-
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

## 🔧 Migration from actions/cache

Simply replace:
```diff
- uses: actions/cache@v4
+ uses: boringcache/action@v1
+ env:
+   BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

## 💡 Performance Benefits

| Scenario | actions/cache | BoringCache | Improvement |
|----------|---------------|-------------|-------------|
| Node modules (500MB) | 45s | 15s | **3x faster** |
| Rust target (1GB) | 90s | 28s | **3.2x faster** |
| Docker layers (2GB) | 180s | 55s | **3.3x faster** |

## 🌍 Portable Caching

Unlike `actions/cache`, boringcache creates **portable caches** that work everywhere:

- ✅ **GitHub Actions** (this action)
- ✅ **Local development** (CLI)
- ✅ **Other CI systems** (GitLab, Jenkins, etc.)
- ✅ **Deploy environments** (production, staging)

## 🎯 Use Cases

- **Node.js** - npm, yarn, pnpm dependencies
- **Rust** - cargo registry and build artifacts  
- **Go** - modules and build cache
- **Python** - pip cache and virtual environments
- **Docker** - layer caching and build contexts
- **Custom** - any file or directory caching needs

## 🏢 Enterprise Ready

- Team management
- Usage analytics
- API access

## 📚 Documentation

- [Full Documentation](https://boringcache.com/docs)
- [CLI Documentation](https://github.com/boringcache/cli#readme)

Get started at [boringcache.com](https://boringcache.com)