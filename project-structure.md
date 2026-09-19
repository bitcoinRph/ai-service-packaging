# Project Structure

## Root Directory Layout

This is the layout `start-cli s9pk init-package` scaffolds (SDK 2.x). `hello-world-startos/` in this repository is the same template.

```
my-service-startos/
├── .github/workflows/      # build.yml, tagAndRelease.yml, release.yml (Start9 reusable workflows)
├── assets/                 # Supplementary files mounted into the container (required, at least one file)
├── startos/                # Primary development directory
│   ├── actions/            # User-facing actions
│   ├── fileModels/         # Type-safe config file representations (zod)
│   ├── i18n/               # default.ts (English keyed by index) and translations.ts
│   ├── init/               # index.ts (init order) plus named init files: seedFiles.ts, watchCredentials.ts
│   ├── manifest/           # index.ts (setupManifest) and i18n.ts (descriptions)
│   ├── versions/           # index.ts (VersionGraph) and current.ts (the live version)
│   ├── backups.ts          # Backup volumes, pg_dump, exclusions
│   ├── dependencies.ts     # Service dependencies
│   ├── index.ts            # Exports (boilerplate)
│   ├── interfaces.ts       # Network interface definitions
│   ├── main.ts             # Daemons, oneshots, health checks
│   ├── sdk.ts              # SDK initialization (boilerplate)
│   └── utils.ts            # Package-specific constants
├── .dockerignore
├── .gitignore
├── AGENTS.md               # Repo-specific agent context; CLAUDE.md is `@AGENTS.md`
├── CLAUDE.md
├── Dockerfile              # Optional - for custom images
├── icon.svg                # Service icon (max 40 KiB), fetched from upstream
├── instructions.md         # End-user instructions, packed into the .s9pk (required by the build)
├── LICENSE                 # Symlink to upstream license
├── Makefile                # ARCHES plus `include node_modules/@start9labs/start-sdk/s9pk.mk`
├── package.json            # depends on @start9labs/start-sdk (pinned exactly)
├── package-lock.json
├── README.md               # Technical reference: how the package differs from upstream
├── tsconfig.json           # extends @start9labs/start-sdk/tsconfig.base.json
├── UPDATING.md             # How to find and apply the next upstream version
└── upstream-project/       # Git submodule (optional)
```

## Core Files

### Boilerplate Files

Leave these as the scaffold ships them: `.gitignore`, `.dockerignore`, `Makefile` (only `ARCHES` changes), `package.json`, `tsconfig.json`, `startos/sdk.ts`, `startos/index.ts`, `startos/i18n/index.ts`, `AGENTS.md` (except its `## This repo` section) and `CLAUDE.md`.

### icon.svg

Maximum 40 KiB. Accepts `.svg`, `.png`, `.jpg`, and `.webp`. Symlink or copy the real upstream asset.

### LICENSE

Always matching the upstream service's license: `ln -sf upstream-project/LICENSE LICENSE`.

### instructions.md

Required at the package root; `start-cli s9pk pack` refuses to build without it. It renders on the Instructions tab in StartOS after install and is written for the end user: a `## Documentation` section with upstream links, what the service gives you on StartOS, numbered setup steps from first launch, and the user-visible actions. See [Writing READMEs](./writing-readmes.md) for the README's different audience.

### README.md

Technical reference for developers and AI assistants: how the package differs from upstream, volumes, interfaces, actions, health checks, backups, limitations, and a YAML quick-reference block. No version numbers.

### UPDATING.md

Where the upstream version pin lives and how to bump it, so a future update needs no rediscovery.

## Key Directories

### assets/

Files packed into the `.s9pk` and mountable with `sdk.Mounts.of().mountAssets({ subpath, mountpoint })`: entrypoint scripts, config templates, a scheduler. Must contain at least one file.

### startos/

The SDK integration. `main.ts` runs on every service start; `init/` runs on install, update, restore and container rebuild; `versions/` carries the version and migrations; `interfaces.ts` runs on install, update and config save.

## Initialization Triggers

Container initialization (`init/`) runs on:

- Fresh installation, update, downgrade, or restore (`kind` is `'install'`, `'update'` or `'restore'`)
- Server restart or the manual **Container Rebuild** action (`kind` is `null`)

Starting or restarting the service does **not** re-run init; it re-runs `main.ts`.
