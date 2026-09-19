# Quick Start

## Prerequisites

Complete the [environment setup](./environment-setup.md) before beginning, including the packaging workspace.

## Creating Your Package Repository

### 1. Create a workspace

A workspace is the directory that holds package repos and the official guide checkout. Create it once, outside any package repo:

```bash
start-cli s9pk init-workspace start9-workspace
cd start9-workspace
```

This clones `Start9Labs/start-technologies` into `start-technologies/` (the official guide is at `projects/start-sdk/docs/src/`), writes `AGENTS.md`, `AGENTS.local.md` and `CLAUDE.md` for AI assistants, and provisions `.startos/` with a signing key and a `config.yaml` for hosts and registries. Clone this guide next to it if you use it as extra context:

```bash
git clone https://github.com/bitcoinRph/ai-service-packaging.git ai-service-packaging
```

### 2. Scaffold the package

```bash
start-cli s9pk init-package "My Service"
```

`init-package` normalizes the display name to an id, creates `my-service-startos/` from the SDK's bundled template (a buildable Hello World clone), runs `git init` and `npm install`, and leaves a `TODO.md` checklist. Do not hand-assemble a package by copying another one; scaffold, then work the checklist. `hello-world-startos/` in this repo is the same template for reference.

### 3. Add Upstream Project (Optional)

If wrapping an existing project's source, add it as a git submodule:

```bash
git submodule add https://github.com/user/project.git upstream-project
```

A package can also live **inside** an upstream fork, for example at `deploy/startos/`, with `dockerBuild: { workdir: '../..', dockerfile: '../../Dockerfile' }` in the manifest. The workspace then sits next to the fork, not inside it. See the [CRM package](https://github.com/bitcoinRph/crm-startos/tree/release/deploy/startos) for a worked example.

## Building Your Package

```bash
cd my-service-startos
make x86        # or: make arm
```

The first build pulls or builds the container image, so it can take minutes. The result is `my-service_x86_64.s9pk`. Building every architecture (`make`) or one multi-arch package (`make universal`) is for publishing.

## Installing to StartOS

### Option 1: Sideload via UI

1. Open your StartOS web interface and log in
2. Click **Sideload** in the top navigation
3. Select the `.s9pk` you built

### Option 2: `make install`

Set `host.default` in the workspace's `.startos/config.yaml`, run `start-cli auth login` once, then `make x86 install`. Only do this when the user has explicitly approved installing to that device.

## Development Workflow

```bash
npm run check        # TypeScript type checking
npm run build        # Build the JS bundle only
make x86             # Full package build (runs check, lint and prettier first)
```

## Next Steps

1. Work the package's `TODO.md` top to bottom (it mirrors the official New Package Checklist)
2. Read `start-technologies/projects/start-sdk/docs/src/recipes.md`: it maps each intent to a recipe and a production package to copy
3. Use this guide's pages ([manifest](./manifest-ts.md), [main.ts](./main-ts.md), [interfaces](./interfaces-ts.md), [init](./init.md), [actions](./actions.md), [file models](./file-models.md)) as the short form of the same material
