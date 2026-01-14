# BoringCache Action

**Cache once. Reuse everywhere.**

A drop-in cache action for GitHub Actions, backed by BoringCache. Store verified cache archives and reuse them across CI, Docker, and local dev.

- Manifest-aware reuse (repeat saves upload **0 bytes** when unchanged)
- Verified restores (integrity checked before extraction)
- Platform-aware safety (OS/arch suffixing by default)
- Unlimited authenticated restores (no egress fees)

## Quick Start

```yaml
- uses: boringcache/action@v1
  with:
    workspace: my-org/my-project
    entries: deps:node_modules,build:dist
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

**What it does:**
- Restores caches at the start of the job
- Saves caches at the end of the job
- If the manifest matches an existing entry, the save is skipped

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `workspace` | yes | Workspace in `org/repo` form (scopes cache entries) |
| `entries` | yes | Comma-separated `tag:path` pairs (e.g. `deps:node_modules`) |
| `no-platform` | no | Disable OS/arch suffix for portable caches. Default: `false` |
| `fail-on-cache-miss` | no | Fail if cache not found. Default: `false` |
| `lookup-only` | no | Check if cache exists without downloading. Default: `false` |
| `force` | no | Overwrite existing cache on save. Default: `false` |
| `save-always` | no | Save even if job fails. Default: `false` |
| `verbose` | no | Enable detailed output. Default: `false` |
| `exclude` | no | Glob patterns to exclude from cache (e.g. `*.out,*.log`) |

## Outputs

| Output | Description |
|--------|-------------|
| `cache-hit` | `true` if exact match found |
| `cache-primary-key` | Key used for restore |
| `cache-matched-key` | Key that matched |

## Migration from actions/cache

```diff
- uses: actions/cache@v4
+ uses: boringcache/action@v1
+ env:
+   BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

### actions/cache-compatible mode

If your workflow uses `path`, `key`, and `restore-keys`:

```yaml
- uses: boringcache/action@v1
  with:
    path: node_modules
    key: node-deps-${{ hashFiles('package-lock.json') }}
    restore-keys: |
      node-deps-
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

## Platform Behavior

By default, caches are isolated by platform (OS + architecture). A cache saved on Linux won't overwrite a macOS cache with the same tag.

For portable artifacts (sources, lockfiles), use `no-platform: true`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BORINGCACHE_API_TOKEN` | API token (required) |
| `BORINGCACHE_DEFAULT_WORKSPACE` | Default workspace (if not specified in inputs) |

## Troubleshooting

**"Unauthorized" or "workspace not found"**
- Ensure `BORINGCACHE_API_TOKEN` is set
- Confirm workspace access in the BoringCache dashboard

**Cache miss**
- Check workspace and entries values
- Remember platform scoping: Linux and macOS caches are separate by default

## License

MIT
