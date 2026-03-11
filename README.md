# boringcache/action

Cache any directory in GitHub Actions with one action.

## When to use it

Choose this if you are replacing `actions/cache` and want the same shape: restore near the start of the job, save on the way out.

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

## Trust model

- On `pull_request` jobs, restore can run with `BORINGCACHE_RESTORE_TOKEN`.
- Save is skipped cleanly when no save-capable token is present.
- Use `BORINGCACHE_SAVE_TOKEN` only on trusted branch, tag, or manual jobs.
- `BORINGCACHE_API_TOKEN` still works, but new workflows should prefer split tokens.

## What it handles

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

## Learn more

- [GitHub Actions docs](https://boringcache.com/docs#action)
- [GitHub Actions auth and trust model](https://boringcache.com/docs#actions-auth)
- [CLI auth model](https://boringcache.com/docs#cli-auth)
