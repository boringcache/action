# boringcache/action

Cache any directory in GitHub Actions with BoringCache. Drop-in replacement for `actions/cache`.

Restores cached directories before your job runs and saves them when it finishes. Caches are content-addressed — identical content is never re-uploaded.

## Quick start

```yaml
- uses: boringcache/action@v1
  with:
    workspace: my-org/my-project
    entries: deps:node_modules,build:dist
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

## Mental model

This action caches directories you explicitly choose.

- You decide what is expensive (dependencies, build outputs, toolchains)
- BoringCache fingerprints the directory contents
- If the content matches an existing cache, uploads are skipped
- The same cache can be reused in CI, Docker builds, or locally

This action does not infer what should be cached and does not modify your build.

## Common patterns

### Simple CI cache

```yaml
- uses: boringcache/action@v1
  with:
    workspace: my-org/my-project
    entries: deps:node_modules
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

### Advanced pattern: Shared bundle cache (runner + Dockerfile)

This pattern shows how to reuse the same cache across the GitHub Actions runner and a Docker image build.

```yaml
name: Docker Build (Shared Bundle Cache)

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-22.04
    env:
      BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
      BORINGCACHE_WORKSPACE: my-org/my-project
      BUNDLE_TAG: bundle

    steps:
      - uses: actions/checkout@v4

      # Atomic cache on the runner (same tag reused in the Dockerfile)
      - uses: boringcache/action@v1
        with:
          workspace: ${{ env.BORINGCACHE_WORKSPACE }}
          entries: ${{ env.BUNDLE_TAG }}:vendor/bundle

      - run: |
          bundle config set path vendor/bundle
          bundle install

      # Whole-image cache + BuildKit layer cache (BoringCache-backed)
      - uses: boringcache/docker-action@v1
        with:
          workspace: ${{ env.BORINGCACHE_WORKSPACE }}
          image: ghcr.io/${{ github.repository }}
          tags: latest,${{ github.sha }}
          build-args: |
            BORINGCACHE_WORKSPACE=${{ env.BORINGCACHE_WORKSPACE }}
            BUNDLE_TAG=${{ env.BUNDLE_TAG }}
          secrets: |
            id=boringcache_token,env=BORINGCACHE_API_TOKEN
```

```Dockerfile
# syntax=docker/dockerfile:1.5
FROM ubuntu:22.04

ARG BORINGCACHE_WORKSPACE
ARG BUNDLE_TAG=bundle

# Install dependencies and Ruby via mise
RUN apt-get update && apt-get install -y curl git build-essential libssl-dev libreadline-dev zlib1g-dev libyaml-dev && \
    curl https://mise.run | sh && \
    ~/.local/bin/mise use -g ruby@3.3

ENV PATH="/root/.local/share/mise/shims:$PATH"

WORKDIR /app
COPY Gemfile Gemfile.lock ./

RUN --mount=type=secret,id=boringcache_token \
  export BORINGCACHE_API_TOKEN="$(cat /run/secrets/boringcache_token)" && \
  curl -sSL https://install.boringcache.com/install.sh | sh && \
  boringcache restore "$BORINGCACHE_WORKSPACE" "${BUNDLE_TAG}:vendor/bundle" || true && \
  bundle config set path vendor/bundle && \
  bundle install && \
  boringcache save "$BORINGCACHE_WORKSPACE" "${BUNDLE_TAG}:vendor/bundle"

COPY . .
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `workspace` | No | repo name | Workspace in `org/repo` form. Defaults to `BORINGCACHE_DEFAULT_WORKSPACE` or repo name. |
| `entries` | No | - | Comma-separated `tag:path` pairs. Required unless using actions/cache-compatible inputs. |
| `path` | No | - | Files/directories to cache (actions/cache compatible). |
| `key` | No | - | Cache key (actions/cache compatible). |
| `restore-keys` | No | - | Fallback restore keys (actions/cache compatible). |
| `cli-version` | No | `v1.7.1` | BoringCache CLI version. Set to `skip` to disable installation. |
| `enableCrossOsArchive` | No | `false` | Enable cross-OS sharing by disabling platform suffixes (actions/cache compatibility). |
| `save-always` | No | `false` | Save even if earlier steps fail. |
| `no-platform` | No | `false` | Disable OS/arch scoping for cache tags. |
| `fail-on-cache-miss` | No | `false` | Fail if cache is not found. |
| `lookup-only` | No | `false` | Check cache existence without downloading. |
| `force` | No | `false` | Overwrite existing cache on save. |
| `verbose` | No | `false` | Enable detailed output. |
| `exclude` | No | - | Glob patterns to exclude (comma-separated, e.g. `*.out,*.log`). |

## Outputs

| Output | Description |
|--------|-------------|
| `cache-hit` | `true` if an exact match was found |
| `cache-primary-key` | Key used for restore |
| `cache-matched-key` | Key that matched |

## Platform behavior

Platform scoping is what makes it safe to reuse caches across machines.

By default, caches are isolated by OS and architecture. Use `no-platform: true` or `enableCrossOsArchive: true` only for portable artifacts (sources, lockfiles).

## Environment variables

| Variable | Description |
|----------|-------------|
| `BORINGCACHE_API_TOKEN` | API token (required) |
| `BORINGCACHE_DEFAULT_WORKSPACE` | Default workspace (if not specified in inputs) |

## Migrating from actions/cache (optional)

```diff
- uses: actions/cache@v4
+ uses: boringcache/action@v1
+ env:
+   BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

If you already use `path`, `key`, and `restore-keys`, those inputs are supported as-is.

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

## Troubleshooting

- Unauthorized or workspace not found: ensure `BORINGCACHE_API_TOKEN` is set and the workspace exists.
- Cache miss: check `workspace` and `entries`, and remember platform scoping.
- Cache hit detection: rely on the `cache-hit` output rather than CLI exit codes.

## Release notes

See https://github.com/boringcache/action/releases.

## License

MIT
