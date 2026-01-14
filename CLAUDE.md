# BoringCache Action

## Overview

Drop-in cache action for GitHub Actions, backed by BoringCache. Store verified cache archives and reuse them across CI, Docker, and local dev.

## Structure

```
action/
├── action.yml              # Combined action (restore + save in post)
├── lib/                    # TypeScript source
│   ├── utils.ts            # Shared utilities
│   ├── restore.ts          # Main phase code
│   ├── save.ts             # Post phase code
│   ├── restore-only.ts     # Restore sub-action code
│   └── save-only.ts        # Save sub-action code
├── dist/
│   ├── restore/index.js    # Bundled restore code
│   ├── save/index.js       # Bundled save code
│   ├── restore-only/index.js
│   └── save-only/index.js
├── package.json
├── tsconfig.json
├── jest.config.js
├── .gitignore
├── README.md
└── CLAUDE.md
```

## Usage

```yaml
- uses: boringcache/action@v1
  with:
    workspace: my-org/my-project
    entries: deps:node_modules,build:dist
  env:
    BORINGCACHE_API_TOKEN: ${{ secrets.BORINGCACHE_API_TOKEN }}
```

## Build Process

```bash
npm install
npm run build  # tsc && ncc build
```

## Action-Specific Notes

- Drop-in replacement for `actions/cache`
- Supports both CLI format (`workspace` + `entries`) and actions/cache format (`path` + `key`)
- Platform-aware safety (OS/arch suffixing by default, disable with `no-platform`)
- Cache tags use `tag:path` format (e.g., `deps:node_modules`)

---

# Standard Conventions

**See [buildkit/CLAUDE.md](../buildkit/CLAUDE.md) for the canonical reference of all BoringCache action conventions including:**

- TypeScript structure (lib/*.ts -> dist/)
- Dependencies (@actions/core, @actions/exec, @vercel/ncc)
- action.yml pattern (main + post)
- Coding conventions
- Input conventions (workspace, entries)
- README.md format
- CLI exit code behavior
