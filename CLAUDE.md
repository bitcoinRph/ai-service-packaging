# Agent Packaging Guide for StartOS

This is the canonical `bitcoinRph/ai-service-packaging` guide for using Claude Code, Codex, Hermes Agent, or OpenClaw to package services for StartOS. The upstream `Start9Labs/ai-service-packaging` repo is archived; treat this repository as the maintained source of truth.

Agent entry points:

- Claude Code: read this `CLAUDE.md` directly, or copy `ROOT_CLAUDE.md` into the parent workspace as `CLAUDE.md`.
- Codex / Codex CLI: read `AGENTS.md`, which routes back to this file.
- Hermes Agent: load the `startos-ai-service-packaging` skill and/or use this repo as the working directory so `AGENTS.md` is injected.
- OpenClaw: use `AGENTS.md` or this `CLAUDE.md`, depending on the adapter.

Build policy: prefer package-repo GitHub Actions for `.s9pk` artifacts using `github-actions.md`. Local `.s9pk` builds require working Docker, SquashFS tools, Node.js v22+, Make, `start-cli` and a packaging workspace. Never install, sideload, update, or restart a live StartOS service without explicit approval.

## SDK 2.x and the official guide

This guide targets `@start9labs/start-sdk` 2.x (`2.0.9` when last checked) and `start-cli` 2.x. Start9's own packaging guide is the source of truth and outranks this one where they differ: `start-cli s9pk init-workspace <dir>` checks it out into `<dir>/start-technologies/projects/start-sdk/docs/src/` (published at <https://docs.start9.com/packaging>). Read its `recipes.md` first for any packaging intent, and `new-package-checklist.md` for a fresh package. Scaffold with `start-cli s9pk init-package "Name"`; do not hand-copy another package. Verify every API against the installed types in `node_modules/@start9labs/start-sdk/**/*.d.ts` before relying on it.

Differences from the 0.4.0-beta material this guide grew from, all reflected in the pages below:

| Area | SDK 2.x |
|------|---------|
| Manifest | `packageRepo`, `upstreamRepo`, `marketingUrl`, `donationUrl`; no `wrapperRepo`, `supportSite`, `docsUrl`, `alerts` |
| Required root files | `instructions.md` (end-user, packed into the s9pk), `README.md`, `UPDATING.md`, `AGENTS.md` + `CLAUDE.md` (`@AGENTS.md`) |
| Versions | `startos/versions/current.ts` is the live version; historical files only when a migration needs them |
| Build | `Makefile` includes `node_modules/@start9labs/start-sdk/s9pk.mk`; nothing vendored; `make x86` runs tsc, the SDK lint runner and prettier before packing |
| Workspace | a parent directory with `.startos/build.key.pem` signs the build; `start-cli` walks up to find it |
| File models | zod (`z` from the SDK), `.catch()` defaults, `merge(effects, {})` to seed; `matches`/`onMismatch` are gone |
| Addresses | `sdk.host.getOwn(effects, hostId)` → `host.bindings[port].interfaces[id].addressInfo`; `sdk.serviceInterface.*` is gone |
| Subcontainers | `sdk.SubContainer.of(...)` is lazy (no `await`); `await sub.rootfs` when you need the path |
| Init | named files (`init/seedSecrets.ts`, `init/watchCredentials.ts`); kinds `install`, `update`, `restore`, `null` |
| Tasks | severities `critical`, `important`, `optional`; idempotent per action |
| Credentials | one `set-admin-*` action generates, stores and returns the credential; an init watcher raises a critical task while it is unset |
| Backups | `sdk.Backups.withPgDump()` / `withMysqlDump()` for databases, `.addVolume()` for the rest |
| CI | Start9's reusable workflows, or its `setup-build-env` action for a package inside another repo |

## Getting Started

1. [Environment Setup](./environment-setup.md) - Install required tools (Docker, Node.js, Start CLI, etc.)
2. [Quick Start](./quick-start.md) - Create your first package from the Hello World template
3. [Project Structure](./project-structure.md) - Understand the file layout and directory purposes

## Detailed Documentation

- [manifest/](./manifest-ts.md) - Service metadata, images, alerts, dependencies (with i18n)
- [Versioning](./versions.md) - ExVer format, `versions/current.ts`, migrations
- [main.ts Patterns](./main-ts.md) - Daemons, oneshots, health checks, volume mounts, PostgreSQL sidecar
- [Initialization Patterns](./init.md) - One-time setup, credential tasks, runUntilSuccess, bootstrapping via API
- [interfaces.ts Patterns](./interfaces-ts.md) - Network interfaces and port bindings
- [Actions](./actions.md) - User-triggered operations and SMTP configuration
- [File Models](./file-models.md) - Type-safe configuration files and store.json
- [Cross-Service Dependencies](./cross-service-dependencies.md) - Dependency tasks, interface reading, volume mounting
- [Makefile](./makefile.md) - Build system with s9pk.mk
- [GitHub Actions CI](./github-actions.md) - Start9's reusable workflows, the composite action, and the workspace key
- [Writing READMEs](./writing-readmes.md) - README structure, AI prompt, and pre-publish checklist

Reference `hello-world-startos/` (the official template at SDK 2.0.9) for boilerplate files (`package.json`, `tsconfig.json`, `Makefile`, `startos/` structure, `AGENTS.md`).

## Project Structure

```
my-service-startos/
├── .github/workflows/      # build.yml, tagAndRelease.yml, release.yml
├── startos/
│   ├── manifest/           # Service metadata
│   │   ├── index.ts        # setupManifest() call
│   │   └── i18n.ts         # Translated descriptions
│   ├── i18n/               # Internationalization
│   │   ├── index.ts        # setupI18n() call (boilerplate)
│   │   └── dictionaries/
│   │       ├── default.ts  # English strings keyed by index
│   │       └── translations.ts  # es_ES, de_DE, pl_PL, fr_FR
│   ├── sdk.ts              # SDK init (boilerplate)
│   ├── index.ts            # Exports (boilerplate)
│   ├── main.ts             # Runtime: daemons, oneshots, health checks
│   ├── interfaces.ts       # Network interfaces
│   ├── backups.ts          # Backup config
│   ├── dependencies.ts     # Service dependencies
│   ├── utils.ts            # Shared constants
│   ├── actions/            # User-triggered actions
│   ├── init/               # Named init files (seedSecrets.ts, watchCredentials.ts)
│   ├── versions/           # index.ts + current.ts
│   └── fileModels/         # Persistent state (store.json.ts)
├── assets/                 # Files mounted into the container (required, at least one file)
├── Dockerfile              # Optional - only if upstream doesn't have one
├── Makefile                # ARCHES + include node_modules/@start9labs/start-sdk/s9pk.mk
├── package.json            # pins @start9labs/start-sdk
├── tsconfig.json           # extends the SDK base config
├── AGENTS.md / CLAUDE.md   # Repo-specific agent context
├── README.md               # Technical reference
├── instructions.md         # End-user instructions (required by the build)
├── UPDATING.md             # Upstream version tracking
├── icon.*                  # Symlink to upstream or copied (svg preferred, max 40 KiB)
├── LICENSE                 # Symlink to upstream license
├── .gitignore
└── upstream-project/       # Git submodule (optional)
```

A package can also live inside an upstream fork (for example `deploy/startos/` with `dockerBuild: { workdir: '../..', dockerfile: '../../Dockerfile' }`); the workspace then sits beside the fork. See [crm-startos](https://github.com/bitcoinRph/crm-startos/tree/release/deploy/startos).

## APIs and When to Use Them

### manifest/

**When**: Always - defines service identity and metadata.

| Field                               | Description                                     |
| ----------------------------------- | ----------------------------------------------- |
| `id`, `title`, `license`, `packageRepo`, `upstreamRepo` | Required metadata                               |
| `volumes`                           | Storage volumes (usually `['main']`)            |
| `images`                            | Docker images with `arch` field                 |
| `description`                       | Locale objects from `manifest/i18n.ts`          |
| `alerts`                            | Locale objects or `null` for lifecycle events    |
| `dependencies`                      | Service dependencies                            |

See [manifest/](./manifest-ts.md) for detailed configuration (images, alerts, dependencies, license/icon setup).

### main.ts - Runtime Configuration

**When**: Always - defines how the service runs.

| API                                                          | When to Use                                                       |
| ------------------------------------------------------------ | ----------------------------------------------------------------- |
| `storeJson.read((s) => s.field).const(effects)`              | Read config reactively (restarts service on change)               |
| `storeJson.read().once()`                                    | Read config once (no restart on change)                           |
| `sdk.host.getOwn(effects, hostId, mapper).const()`           | Get the host; `host.bindings[port].interfaces[id].addressInfo` formats URLs |
| `sdk.SubContainer.of(effects, {imageId}, mounts, name)`      | Create container with volume mounts (lazy, no await)              |
| `sdk.useEntrypoint()`                                        | Use upstream image's ENTRYPOINT/CMD (prefer over custom command)  |
| `sdk.useEntrypoint([args])`                                  | Use upstream ENTRYPOINT with custom CMD arguments                 |
| `writeFile(\`${await appSub.rootfs}/path\`, content)`        | Write ephemeral config to subcontainer rootfs                     |
| `sdk.volumes.main`                                           | Volume object for the 'main' volume (implements PathBase)         |
| `sdk.volumes.main.subpath('file.txt')`                       | Get absolute path to file within volume                           |
| `sdk.volumes.main.readFile('file.txt')`                      | Read file from volume (returns Buffer or string)                  |
| `sdk.volumes.main.writeFile('file.txt', data)`               | Write file to volume (creates parent dirs automatically)          |
| `sdk.Daemons.of(effects).addOneshot(...)`                    | Idempotent startup tasks (migrations, etc.)                       |
| `sdk.Daemons.of(effects).addDaemon(...)`                     | Long-running processes                                            |
| `sdk.healthCheck.checkPortListening(effects, port, msgs)`    | Health check for daemon readiness                                 |

See [main.ts patterns](./main-ts.md) for detailed examples.

### interfaces.ts

**When**: Service exposes network interfaces (web UI, API, etc.).

| API                                          | When to Use                         |
| -------------------------------------------- | ----------------------------------- |
| `sdk.MultiHost.of(effects, 'ui-multi')`      | Create network binding              |
| `uiMulti.bindPort(port, {protocol: 'http'})` | Bind to a port                      |
| `sdk.createInterface(effects, {...})`        | Define an interface (UI, API, etc.) |
| `origin.export([...interfaces])`             | Export interfaces                   |

See [interfaces.ts patterns](./interfaces-ts.md) for multiple interfaces.

### actions/

**When**: Users need to trigger operations (get credentials, reset password, etc.).

| API                                                      | When to Use                 |
| -------------------------------------------------------- | --------------------------- |
| `sdk.Action.withoutInput(id, metadata, handler)`         | Action with no user input   |
| `sdk.Action.withInput(id, inputSpec, metadata, handler)` | Action requiring user input |
| `sdk.Actions.of().addAction(...)`                        | Register actions            |

See [actions.md](./actions.md) for action patterns.

### dependencies.ts - Cross-Service Dependencies

**When**: Service depends on another StartOS service.

| API                                                                           | When to Use                                     |
| ----------------------------------------------------------------------------- | ----------------------------------------------- |
| `sdk.action.createTask(effects, packageId, action, severity, options)`        | Trigger an action on a dependency service        |
| `sdk.host.get(effects, {hostId, packageId}, mapper).const()`                  | Read a dependency's host and interfaces reactively |
| `sdk.host.getBridgeAddress(effects, {hostId, packageId, internalPort})`       | The address a dependency's binding has from this container |
| `sdk.Mounts.of().mountDependency({dependencyId, volumeId, ...})`             | Mount a dependency's volume for file access      |

See [Cross-Service Dependencies](./cross-service-dependencies.md) for patterns and examples.

### init/ (named files such as seedSecrets.ts, watchCredentials.ts)

**When**: Need one-time setup on install (generate secrets, bootstrap via API) or a task that prompts the user.

| API                                                             | When to Use                                  |
| --------------------------------------------------------------- | -------------------------------------------- |
| `sdk.setupOnInit(async (effects, kind) => {...})`               | Run code on init (`install`, `update`, `restore`, `null`) |
| `storeJson.merge(effects, {...})`                               | Seed or persist state (defaults from the zod schema) |
| `sdk.action.createOwnTask(effects, action, severity, {reason})` | Prompt user to run an action (`critical` blocks start) |
| `utils.getDefaultString({charset, len})`                        | Generate random strings                      |
| `.runUntilSuccess(timeout)`                                     | Run daemons/oneshots and wait for completion |

See [Initialization Patterns](./init.md) for `runUntilSuccess` and bootstrapping via API.

### fileModels/store.json.ts

**When**: Need to persist service state (passwords, secrets, settings).

| API                                           | When to Use                      |
| --------------------------------------------- | -------------------------------- |
| `FileHelper.json({base: sdk.volumes.main, subpath}, shape)` | JSON file with schema validation |
| `z.object({...})` with `.catch()` defaults (`z` from the SDK) | Define the shape; `merge(effects, {})` seeds it |

## Writing Files

- **Subcontainer rootfs** (`${appSub.rootfs}/path`): For ephemeral config regenerated on startup
- **Volume via sdk.volumes** (`sdk.volumes.main.writeFile('file.txt', data)`): For persistent data that survives restarts
- **Volume via FileHelper** (`FileHelper.json({base: sdk.volumes.main, subpath}, shape)`): For type-safe config files on volumes
- **Volume file mount**: Add `type: 'file'` when mounting a single file from a volume

See [main.ts patterns](./main-ts.md) for details on rootfs vs volume mounts.

## Dockerfile

For upstream projects, use git submodules:

```bash
git submodule add https://github.com/user/project.git upstream-project
```

See [manifest.ts](./manifest-ts.md) for Docker image configuration (`dockerTag` vs `dockerBuild`).

## Build Commands

`make` needs a packaging workspace above the package: a directory holding `.startos/build.key.pem`. Create one once in the directory that holds your package repos (never inside a package): `start-cli s9pk init-workspace .`

```bash
npm run check    # TypeScript check
npm run build    # Build JS bundle
make x86         # Build the .s9pk for one architecture (runs check, lint, prettier first)
make             # Every architecture in ARCHES
make install     # Install the latest build to the workspace's host.default (needs explicit approval)
```

When creating or repairing GitHub Actions workflows, follow [GitHub Actions CI](./github-actions.md): Start9's reusable workflows for a stand-alone package repo, its `setup-build-env` action plus a provisioned workspace key for a package inside another repository.

## Code Style Guidelines

### Formatting

Use Prettier for all TypeScript files. Configuration lives in `package.json`:

```json
{
  "prettier": {
    "trailingComma": "all",
    "tabWidth": 2,
    "semi": false,
    "singleQuote": true
  }
}
```

Run `npm run prettier` before committing.

Key rules:
- No semicolons
- Single quotes
- Trailing commas everywhere
- 2-space indentation

### TypeScript

- Enable `strict: true` in `tsconfig.json`
- Use `const` exports with arrow functions (e.g. `export const main = sdk.setupMain(async (...) => { ... })`)
- Prefer `const` over `let`; never use `var`
- Use the SDK's type system — don't cast with `as` or use `any` unless absolutely necessary

### Imports

- SDK/library imports first, then local imports
- Use relative paths for local imports (e.g. `'./sdk'`, `'../actions'`)

### Documentation & Comments

- Keep comments focused on "why" rather than "what"
- Don't add comments that just restate the code
- Mark boilerplate files with `/** Plumbing. DO NOT EDIT. */` so packagers know what to leave alone
- Update or remove comments when code changes

### Naming

- Files: `camelCase.ts` for code, `kebab-case.md` for docs
- Version files: `versions/current.ts`; a historical version is `vX.Y.Z_N.ts` exporting `v_X_Y_Z_N`
- Variables/functions: `camelCase`
- Types/interfaces: `PascalCase`
- Constants (ports, config keys): `camelCase` (e.g. `uiPort`, not `UI_PORT`)

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Scope** is the service name (e.g. `hello-world`, `nextcloud`, `bitcoin`).

**Examples:**
```
feat(nextcloud): add smtp configuration action
fix(bitcoin): resolve health check timeout
chore(hello-world): bump SDK to 0.4.0-beta.48
```

## Checklist

- [ ] `.gitignore` copied from `hello-world-startos/.gitignore` (boilerplate)
- [ ] `manifest/index.ts` configured with correct license, `packageRepo`, `upstreamRepo`, and `arch` on all images
- [ ] `manifest/i18n.ts` has translated `short` and `long` descriptions
- [ ] `instructions.md`, `README.md`, `UPDATING.md` written; `AGENTS.md` `## This repo` filled or removed
- [ ] `LICENSE` symlink to upstream license file
- [ ] `icon.*` symlink to upstream icon or custom (svg preferred, max 40 KiB)
- [ ] `assets/` directory exists (can be empty with README.md)
- [ ] Docker image configured (upstream Dockerfile via `workdir` or custom Dockerfile)
- [ ] `main.ts` defines daemons/oneshots
- [ ] `interfaces.ts` exposes network
- [ ] `init/` generates internal secrets on install; a credentials action plus watcher task if the app has a login
- [ ] `actions/` for user operations (if needed), every string through `i18n()`, translations complete
- [ ] `fileModels/store.json.ts` for state (if needed)
- [ ] `backups.ts` covers every volume; databases via `withPgDump`/`withMysqlDump`
- [ ] `npm run check` passes and `make x86` succeeds (locally or in CI)
- [ ] Installed on a StartOS box and used for real; a green `tsc` proves nothing about the service

## Supplementary Files

These files live at the **session root** (the directory where Claude is launched, i.e. the parent directory that contains this repo), not inside this repo:

- `TODO.md` - Pending tasks for AI agents (check this first, remove items when completed)
- `USER.md` - Current user identifier (gitignored, varies per developer)

### Session Startup

On startup:

1. **Check for `USER.md` at the session root** - If it doesn't exist, prompt the user for their name/identifier and create it there. This file is gitignored since it varies per developer.

2. **Check `TODO.md` at the session root for relevant tasks** - Show TODOs that either:
   - Have no `@username` tag (relevant to everyone)
   - Are tagged with the current user's identifier

   Skip TODOs tagged with a different user.

3. **Ask "What would you like to do today?"** - Offer options:
   - Each relevant TODO item
   - **"Package a new service"** (see below)
   - "Something else"

### Package a New Service

The user can request a new package in 4 ways. Each entry point resolves to a specific open-source project before moving on to the shared workflow below.

#### Entry Point 1: Repository URL

The user provides a URL to an open-source repo (e.g. `https://github.com/user/project`).

- Use the URL directly as the upstream repo.
- Research the repo (README, Dockerfile, docker-compose, docs) to gather the required info below.

#### Entry Point 2: Project name (open source)

The user gives the name of a known open-source self-hosted project (e.g. "Nextcloud", "Gitea").

- Search for the project on GitHub/GitLab/etc. to find the canonical repo.
- If ambiguous (multiple projects with similar names), prompt the user to choose.
- Once the repo is identified, proceed as Entry Point 1.

#### Entry Point 3: Product name (closed source)

The user names a closed-source product they want a self-hosted alternative to (e.g. "Google Docs", "Slack").

- Search for open-source, self-hostable alternatives to that product.
- If multiple viable options exist, present them to the user with brief descriptions and let them choose.
- Once the user picks a project, proceed as Entry Point 1.

#### Entry Point 4: Description of need

The user describes what they need in general terms (e.g. "something that manages my bookmarks", "a private photo gallery").

- Search for open-source, self-hostable projects that fit the description.
- Present the best candidates to the user with brief descriptions and let them choose.
- Once the user picks a project, proceed as Entry Point 1.

#### Gathering Required Info

Once an upstream repo is identified, gather the following information. Research the repo first (README, Dockerfile, docker-compose files, docs, environment variables) — extract as much as you can automatically and only ask the user about what's still unclear.

**Required info:**
1. **Service name** - What is the service called?
2. **Upstream repo** - URL to the source code (e.g. GitHub)
3. **What it does** - Brief description for the manifest
4. **License** - Check the upstream repo's LICENSE file for the SPDX identifier
5. **Docker image** - Does the upstream project publish a Docker image (e.g. on Docker Hub / GHCR), or does the repo contain a Dockerfile, or do we need to write one?
6. **Ports** - What port(s) does the service listen on? Which are web UIs vs APIs?
7. **Configuration** - Does the service need config files? Environment variables? Command-line flags?
8. **Persistent data** - Where does the service store its data? (database path, data directory, etc.)
9. **Authentication** - Does the service have its own auth (admin password, API keys)? How is it initially configured?
10. **Dependencies** - Does it depend on other StartOS services (e.g. PostgreSQL, Bitcoin)?

**Then follow this workflow:**
1. Scaffold `[service-name]-startos/` in the workspace with `start-cli s9pk init-package "[Service Name]"` (sibling to this guide), or, when the upstream is a fork you maintain, create `deploy/startos/` inside it from `hello-world-startos/`
2. Add the upstream project as a git submodule (skip when packaging inside the fork)
3. Work through each file in the project structure using the documentation in this guide:
   - `manifest/` — fill in metadata, images (with `arch`), license, dependencies, translated descriptions ([manifest-ts.md](./manifest-ts.md))
   - `main.ts` — set up daemons, health checks, volume mounts, config file generation ([main-ts.md](./main-ts.md))
   - `interfaces.ts` — expose ports and interfaces ([interfaces-ts.md](./interfaces-ts.md))
   - `init/` — generate secrets, bootstrap state on install, raise the credentials task ([init.md](./init.md))
   - `actions/` — add user actions like "Set Admin Password" and configuration forms ([actions.md](./actions.md))
   - `fileModels/store.json.ts` — define persistent state shape ([file-models.md](./file-models.md))
   - `Dockerfile` — write one if upstream doesn't provide a suitable image ([manifest-ts.md](./manifest-ts.md))
   - Symlink `LICENSE` and `icon.*` from upstream; write `instructions.md`, `README.md`, `UPDATING.md`
4. Run `npm run check` and fix any type errors
5. Make sure a workspace exists above the package (`start-cli s9pk init-workspace .` in the parent, once)
6. Run `make x86` to build the `.s9pk`, or push and let CI build it when Docker is unavailable
7. If adding CI, use the current [GitHub Actions CI](./github-actions.md) pattern
8. Walk through the [Checklist](#checklist) to verify nothing was missed
