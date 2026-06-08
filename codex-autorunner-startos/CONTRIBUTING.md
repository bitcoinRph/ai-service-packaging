# Contributing / Building

This is the StartOS wrapper for [Codex Autorunner](https://github.com/Git-on-my-level/codex-autorunner).

## Prerequisites

- [Start CLI / StartOS SDK](https://docs.start9.com/latest/developer-guide/sdk/installing-the-sdk)
- Docker (with buildx)
- Node.js ≥ 20 and npm
- `git` (the upstream source is a submodule)

## Clone with submodule

```bash
git clone --recurse-submodules <this-repo>
cd ai-service-packaging/codex-autorunner-startos
# or, after a plain clone:
git submodule update --init --recursive
```

The upstream source lives at `codex-autorunner/` (pinned submodule).

## Validate the wrapper code

```bash
npm install
npm run check      # tsc --noEmit
npm run prettier   # format startos/
npm run build      # bundle startos/index.ts -> javascript/
```

## Build the .s9pk

```bash
make          # builds for the arches in the Makefile (x86_64, aarch64)
make x86      # single arch
make install  # install to the StartOS host in ~/.startos/config.yaml
```

The Docker image is built from `./Dockerfile` (multi-stage):

1. **web** stage builds the Svelte UI (`pnpm web:build`) into
   `src/codex_autorunner/web_static`.
2. **app** stage `pip install`s the Python package (which bundles `web_static`
   via setuptools package-data) onto `python:3.11-slim`, plus `git` and `tini`.

## Bumping the upstream version

```bash
cd codex-autorunner
git fetch && git checkout <new-tag>
cd ..
git add codex-autorunner
```

Then update `version` in `startos/versions/current.ts` (ExVer, e.g. `2.1.3:0`),
add release notes, and confirm the Svelte/Python build still succeeds.
