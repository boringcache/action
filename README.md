# boringcache/action

**A portable build cache for GitHub Actions.**  
Cache once, reuse anywhere — CI, deploy, or local dev.  

This Action wraps the [boringcache CLI](https://boringcache.com/docs), making it easy to use boringcache inside GitHub Actions.  
Unlike `actions/cache`, caches saved here are **portable** — you can reuse them locally or in other CI systems.

👉 [Website](https://boringcache.com) · [Docs](https://boringcache.com/docs) · [Pricing](https://boringcache.com/pricing)

---

## 🚀 Features

- **3x faster** than actions/cache with intelligent optimizations
- **Drop-in replacement** - works with existing workflows
- **Portable caches** - reuse in CI, deploy, or local dev
- **Workspace format** for multi-cache scenarios
- **Cross-platform** caching (Linux, macOS, Windows)
- **Content-based chunking** - Fast incremental updates
- **Block-level deduplication** - Save bandwidth and storage
- **Zstd compression** - Predictable ratios and fast restores
- **Automatic CLI installation** - no setup required
- **Early cache hit detection** - 1ms response vs 15s+ without
- **SHA256 verification** - Prevents cache poisoning
- **Streaming I/O** - Memory-efficient for large files

## Quick Start

Use the unified `tag:path` format for cache entries:

```yaml
- uses: boringcache/action@v1
  with:
    workspace: my-org/my-project
    entries: "node-deps:node_modules,build-cache:target"
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

**Format:** `tag:path` where:
- `tag` - Cache identifier (e.g., `node-deps`, `build-cache`)
- `path` - Local directory to cache (e.g., `node_modules`, `target`)
- To write restored data somewhere else (e.g., staging to temp dir), use `tag:restore_path=>save_path`
- Platform suffix is automatically appended (e.g., `node-deps-ubuntu-22.04-amd64`)
- Use `no-platform: true` to disable automatic platform suffixes

### Best Practices
- Always make tag names unique per workflow run when jobs run in parallel (include `${{ matrix.run }}` or similar).
- Avoid saving to the same tag from more than one runner without coordination.
- Scope tags by workload or workflow (e.g., `docker-build-web`, `bazel-ci-linux`) so unrelated pipelines never overwrite each other.
- Give atomic caches (Docker BuildKit, Bazel, Gradle remote caches, etc.) dedicated tags per job to keep state isolated.
- Treat 409/422 conflicts, optimistic lock errors, transient 5xx, and timeouts as retryable with jitter.
- After an upload failure, check cache existence; if the entry exists, treat as success to keep runs idempotent.

## Examples

### Node.js Dependencies

```yaml
- name: Cache Node Dependencies
  uses: boringcache/action@v1
  with:
    workspace: my-org/my-project
    entries: "node-deps:node_modules"
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

### Rust Build Cache

```yaml
- name: Cache Rust Build
  uses: boringcache/action@v1
  with:
    workspace: my-org/my-project
    entries: "build-cache:target,cargo-registry:~/.cargo/registry"
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

### Multiple Caches

```yaml
- name: Cache Multiple Artifacts
  uses: boringcache/action@v1
  with:
    workspace: my-org/my-project  
    entries: "node-deps:node_modules,build-cache:target,compiled-assets:dist"
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

### Workspace Format (Recommended)
| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `workspace` | Workspace identifier (`namespace/workspace`) | No* | Repository name |
| `entries` | Cache entries in `tag:path` format (comma-separated for multiple) | No* | |

**Example:** `"node-deps:node_modules,build:target"`

### actions/cache Compatible Format
| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `path` | Files, directories, and wildcard patterns to cache | No* | |
| `key` | Explicit key for restoring and saving the cache | No* | |
| `restore-keys` | Ordered list of prefix-matched keys for fallback | No | |

### Options

#### GitHub Actions Features (Handled at Action Level)
| Input | Description | Default |
|-------|-------------|---------|
| `upload-chunk-size` | Chunk size for splitting large files during upload (bytes) | Auto |
| `enableCrossOsArchive` | Enable cross-platform cache sharing (translates to `--no-platform`) | `false` |
| `save-always` | Save cache even if other steps fail | `false` |

#### CLI Flags (Passed Directly to CLI)
| Input | Description | Default |
|-------|-------------|---------|
| `no-platform` | Disable automatic platform suffix for tags | `false` |
| `fail-on-cache-miss` | Fail workflow if cache entry not found | `false` |
| `lookup-only` | Check cache existence without downloading | `false` |
| `force` | Force save even if cache entry already exists | `false` |
| `verbose` | Enable detailed output | `false` |

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

## CLI Features & Optimizations

### ⚡ Performance
- **Early cache hit detection** - 1ms response for existing caches (vs 15s+ without optimization)
- **Instant UI feedback** - Shows progress immediately before network operations
- **Zero startup delay** - Optimized initialization order eliminates 1-2s hangs
- **Preflight validation** - Checks permissions and disk space before expensive operations
- **Connection pooling** - Reuses HTTP connections for multiple operations

### 📦 Chunking & Deduplication
- **Content-based chunking** - Splits files into variable-size chunks for optimal deduplication
- **Block-level deduplication** - Only uploads unique chunks, saves bandwidth and storage
- **Zstd chunk compression** - Predictable compression ratios and fast decompression
- **Streaming I/O** - Memory-efficient processing for large files
- **Incremental updates** - Only transfer changed chunks, not entire archives

### 🔒 Security
- **SHA256 content verification** - Prevents cache poisoning attacks
- **Path traversal protection** - Safe archive extraction with path validation
- **Permission safety** - Disables dangerous setuid/setgid permission preservation
- **Resource limits** - Protects against zip bombs and excessive resource usage

### 🌍 Cross-Platform
- **Automatic platform detection** - Detects OS, distro, and architecture
- **Platform suffix support** - Isolates platform-specific caches by default
- **Cross-platform mode** - Use `no-platform: true` for platform-agnostic caches
- **Symlink preservation** - Maintains symbolic links in archives

## Advanced Examples

### Force Overwrite Existing Cache
```yaml
- uses: boringcache/action@v1
  with:
    workspace: my-org/project
    entries: "build:dist"
    force: true  # Overwrite even if cache exists
```

### Fail on Cache Miss
```yaml
- uses: boringcache/restore@v1
  with:
    workspace: my-org/project
    entries: "critical-deps:node_modules"
    fail-on-cache-miss: true  # Fail workflow if cache not found
```

### Lookup Only (Check Without Downloading)
```yaml
- uses: boringcache/restore@v1
  with:
    workspace: my-org/project
    entries: "optional-cache:build"
    lookup-only: true  # Only check if cache exists
```

### Cross-Platform Cache Sharing
```yaml
- uses: boringcache/action@v1
  with:
    workspace: my-org/project
    entries: "js-deps:node_modules"
    no-platform: true  # Share cache across Linux/macOS/Windows
    # Or use: enableCrossOsArchive: true (backward compatible)
```

### Verbose Debugging
```yaml
- uses: boringcache/action@v1
  with:
    workspace: my-org/project
    entries: "debug-cache:artifacts"
    verbose: true  # Enable detailed CLI output
```

### Save Always (Even on Failure)
```yaml
- uses: boringcache/action@v1
  with:
    workspace: my-org/project
    entries: "partial-build:target"
    save-always: true  # Save cache even if build fails
```

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
