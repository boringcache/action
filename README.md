# boringcache/action

Cache any directory in GitHub Actions with BoringCache.

Use this when you want one action that restores near job start and saves at the end.

## Quick start

```yaml
- uses: boringcache/action@v1
  with:
    workspace: my-org/my-project
    entries: deps:node_modules,build:dist
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ github.event_name == 'pull_request' && '' || secrets.BORINGCACHE_SAVE_TOKEN }}
```

On `pull_request` jobs, restore still runs and the post-save step is skipped when no save-capable token is configured.

## What it does

- Caches the directories you choose in `tag:path` form.
- Supports `actions/cache`-style `path`, `key`, and `restore-keys` inputs.
- Keeps platform scoping on by default.
- Uploads only when a save-capable token is available.

## Key inputs

| Input | Description |
|-------|-------------|
| `workspace` | Workspace in `org/repo` form. Defaults to the repo name. |
| `entries` | Comma-separated `tag:path` pairs. |
| `path`, `key`, `restore-keys` | `actions/cache` compatibility inputs. |
| `no-platform` / `enableCrossOsArchive` | Disable platform suffixing for portable caches only. |
| `save-always` | Save even if the job fails. |
| `cli-version` | CLI version to install. Set to `skip` to disable setup. |

## Outputs

| Output | Description |
|--------|-------------|
| `cache-hit` | Whether an exact match was restored. |
| `cache-primary-key` | Primary key used for restore. |
| `cache-matched-key` | Key that matched. |

## Docs

- [GitHub Actions docs](https://boringcache.com/docs#action)
- [GitHub Actions auth and trust model](https://boringcache.com/docs#actions-auth)
- [CLI auth model](https://boringcache.com/docs#cli-auth)
