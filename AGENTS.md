# BoringCache Action

## What It Does

Drop-in replacement for `actions/cache`. Restores cache at job start, saves at job end.

## Quick Reference

```yaml
- uses: boringcache/action@v1
  with:
    workspace: my-org/my-project
    entries: deps:node_modules,build:dist
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

## Key Features

- **Manifest-aware**: Skips upload when content unchanged (0 bytes)
- **Platform-aware**: OS/arch scoping by default (disable with `no-platform: true`)
- **Compatible modes**: Supports both `entries` format and `actions/cache` format (`path`/`key`/`restore-keys`)

## Inputs

| Input | Description |
|-------|-------------|
| `workspace` | BoringCache workspace (`org/repo`) |
| `entries` | Cache entries (`tag:path,tag2:path2`) |
| `no-platform` | Disable OS/arch suffix for portable caches |
| `fail-on-cache-miss` | Fail if cache not found |
| `force` | Overwrite existing cache on save |
| `save-always` | Save even if job fails |

## Outputs

| Output | Description |
|--------|-------------|
| `cache-hit` | `true` if exact match found |
| `cache-primary-key` | Key used for restore |

## Code Structure

- `lib/restore.ts` - Main phase: restore cache entries
- `lib/save.ts` - Post phase: save cache entries
- `lib/restore-only.ts` - For `boringcache/action/restore` sub-action
- `lib/save-only.ts` - For `boringcache/action/save` sub-action
- `lib/utils.ts` - Shared utilities (CLI install, exec, cache helpers)

## Build

```bash
npm install && npm run build && npm test
```

---
**See [../AGENTS.md](../AGENTS.md) for shared conventions.**
