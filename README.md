# boringcache/action

**Cache once. Reuse everywhere.**

A GitHub Action to cache and restore build artifacts with manifest-aware deduplication.

Drop-in replacement for `actions/cache` with portable, verified archives.

## Why BoringCache

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

## Workflow: Shared bundle cache (runner + Dockerfile)

This shows BoringCache at two layers: `boringcache/action` caches `vendor/bundle` on the runner, while `boringcache/docker` caches BuildKit layers. The Dockerfile restores/saves the same bundle tag so the cache is shared between the runner and image build. Both use `ubuntu-22.04` so native gems stay compatible.

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
      - uses: boringcache/docker@v1
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

## Release Notes

See https://github.com/boringcache/action/releases.

## License

MIT
