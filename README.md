# boringcache/action

**A portable build cache for GitHub Actions.**  
Cache once, reuse anywhere — CI, deploy, or local dev.  

This Action wraps the [boringcache CLI](https://boringcache.com/docs), making it easy to use boringcache inside GitHub Actions.  
Unlike `actions/cache`, caches saved here are **portable** — you can reuse them locally or in other CI systems.

👉 [Website](https://boringcache.com) · [Docs](https://boringcache.com/docs) · [Pricing](https://boringcache.com/pricing)

---

## 🚀 Features

- **3x faster** than actions/cache  
- **Drop-in replacement** - works with existing workflows
- **Portable caches** - reuse in CI, deploy, or local dev
- **Workspace format** for multi-cache scenarios
- **Cross-platform** caching (Linux, macOS, Windows)
- **Intelligent compression** (LZ4/ZSTD auto-selection)
- **Automatic CLI installation** - no setup required

## Quick Start

Use the workspace format for multiple cache entries in a single call:

```yaml
- uses: boringcache/action@v1
  with:
    workspace: my-org/my-project
    entries: "node_modules:node-deps,target:build-cache"
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

## Examples

### Node.js Dependencies

```yaml
- name: Cache Node Dependencies
  uses: boringcache/action@v1
  with:
    workspace: my-org/my-project
    entries: "node_modules:node-deps"
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

### Rust Build Cache

```yaml
- name: Cache Rust Build
  uses: boringcache/action@v1
  with:
    workspace: my-org/my-project
    entries: "target:build-cache,~/.cargo/registry:cargo-registry"
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

### Multiple Caches

```yaml
- name: Cache Multiple Artifacts
  uses: boringcache/action@v1
  with:
    workspace: my-org/my-project  
    entries: "node_modules:node-deps,target:build-cache,dist:compiled-assets"
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

### Portable Cache Across Environments

```yaml
- name: Cache Build Tools
  uses: boringcache/action@v1
  with:
    workspace: my-org/shared-tools
    entries: "build-tools:~/tools,docker-images:~/.docker"
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

## Inputs

### Workspace Format
| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `workspace` | Workspace identifier (`namespace/workspace`) | No* | Repository name |
| `entries` | Cache entries (`path:tag` for save, `tag:path` for restore) | No* | |

### actions/cache Compatible Format
| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `path` | Files, directories, and wildcard patterns to cache | No* | |
| `key` | Explicit key for restoring and saving the cache | No* | |
| `restore-keys` | Ordered list of prefix-matched keys for fallback | No | |

### Options
| Input | Description | Default |
|-------|-------------|---------|
| `enableCrossOsArchive` | Allow cross-OS cache sharing | `false` |
| `enable-platform-suffix` | Auto-append platform suffix to keys | `false` |
| `fail-on-cache-miss` | Fail workflow on cache miss | `false` |
| `lookup-only` | Check cache existence without downloading | `false` |
| `save-always` | Save cache even if other steps fail | `false` |

*Either (`workspace` + `entries`) OR (`path` + `key`) is required

## Outputs

| Output | Description |
|--------|-------------|
| `cache-hit` | Boolean indicating exact match for primary key |
| `cache-primary-key` | Key of attempted cache restore |
| `cache-matched-key` | Key of actual cache match |

## Environment Variables

Set as repository secrets:

- `BORINGCACHE_API_TOKEN` - Your BoringCache API token (required)

## actions/cache Compatibility

For easy migration from `actions/cache`, this action supports the same API:

```yaml
# Drop-in replacement for actions/cache
- uses: boringcache/action@v1
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

### Migration from actions/cache

```diff
- uses: actions/cache@v4
+ uses: boringcache/action@v1
+ env:
+   BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

### Separate Actions Migration

```diff
- uses: actions/cache/restore@v4
+ uses: boringcache/restore@v1

- uses: actions/cache/save@v4  
+ uses: boringcache/save@v1
```

## Performance Comparison

| Scenario | actions/cache | BoringCache | Improvement |
|----------|---------------|-------------|-------------|
| Node modules (500MB) | 45s | 15s | **3x faster** |
| Rust target (1GB) | 90s | 28s | **3.2x faster** |
| Docker layers (2GB) | 180s | 55s | **3.3x faster** |

## Setup

1. **Get API Token**: Sign up at [boringcache.com](https://boringcache.com)
2. **Add Secret**: Add `BORINGCACHE_API_TOKEN` to your repository secrets  
3. **Use Action**: Add the action to your workflow

## Portable Caching Benefits

- **Cache once, reuse anywhere** - CI, deploy, local dev
- **Cross-platform portability** - same cache on different systems
- **Unified cache management** across all environments
- **Cost-effective** - avoid rebuilding the same artifacts everywhere

## License

MIT - see [LICENSE](LICENSE) for details.