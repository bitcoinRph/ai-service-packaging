# Agent Packaging Guide for StartOS

Agent Packaging Guide is the canonical `bitcoinRph` playbook for packaging self-hosted services for [StartOS](https://start9.com). It preserves the useful StartOS packaging guidance from the now-archived `Start9Labs/ai-service-packaging` upstream and adapts it for multiple coding agents:

- Claude Code
- OpenAI Codex / Codex CLI
- Hermes Agent
- OpenClaw

The guide teaches an agent how to turn an upstream open-source service into a StartOS `.s9pk` package: discovery, manifest wiring, daemons, interfaces, actions, file models, versioning, CI builds, and safe handoff.

It tracks **`@start9labs/start-sdk` 2.x** and `start-cli` 2.x. Start9's own guide is the source of truth: `start-cli s9pk init-workspace` clones it into `<workspace>/start-technologies/projects/start-sdk/docs/src/` (published at <https://docs.start9.com/packaging>), and its `recipes.md` maps every packaging intent to a recipe and a production package to copy. This repository is the condensed, multi-agent form; where the two disagree, the official guide wins.

## Canonical source

Use this repository as the maintained source of truth:

```sh
git clone https://github.com/bitcoinRph/ai-service-packaging.git ai-service-packaging
```

The original upstream `Start9Labs/ai-service-packaging` repository is archived. Do not depend on it for future updates.

## Agent entry points

Different agents discover instruction files differently. This repo supports all of the following:

| Agent/runtime | Entry point | How to use |
|---|---|---|
| Claude Code | `CLAUDE.md` / `ROOT_CLAUDE.md` | Copy `ROOT_CLAUDE.md` into a packaging workspace as `CLAUDE.md`, or open Claude Code inside this repo. |
| OpenAI Codex / Codex CLI | `AGENTS.md` | Copy `AGENTS.md` into the workspace root, or keep this repo checked out as `ai-service-packaging/`. |
| Hermes Agent | `AGENTS.md` + Hermes skill | Run Hermes with this repo as context, or use the `startos-ai-service-packaging` skill distilled from these docs. |
| OpenClaw | `AGENTS.md` / `CLAUDE.md` | Point the OpenClaw workspace at this repo or copy the root instruction file into the service workspace. |

All agent entry points route back to `CLAUDE.md`, which remains the full packaging reference.

## Recommended workspace layout

```text
services/
├── ai-service-packaging/     # this guide repo
├── CLAUDE.md                 # optional: copy of ai-service-packaging/ROOT_CLAUDE.md for Claude Code
├── AGENTS.md                 # optional: copy of ai-service-packaging/AGENTS.md for Codex/Hermes/OpenClaw
└── my-service-startos/       # package repo generated from hello-world-startos or equivalent
```

Bootstrap:

```sh
mkdir -p services
cd services
git clone https://github.com/bitcoinRph/ai-service-packaging.git ai-service-packaging
cp ai-service-packaging/ROOT_CLAUDE.md CLAUDE.md
cp ai-service-packaging/AGENTS.md AGENTS.md
```

Then run `start-cli s9pk init-workspace .` in `services/` so the signing key, the official guide checkout and the workspace agent context exist next to this one, and open your preferred agent in `services/`. Ask it to package a service: a GitHub repo URL, a Docker image, a product name, or a description of what you need.

## Build strategy

Prefer GitHub Actions for `.s9pk` builds unless your local machine has a fully working StartOS packaging toolchain. The current CI pattern is documented in [GitHub Actions CI](./github-actions.md).

Key rules:

1. A package at the root of its own repository uses Start9's reusable workflows (`Start9Labs/start-technologies/.github/workflows/build.yml@master`) exactly as the SDK template ships them.
2. A package inside another repository uses the `setup-build-env` composite action and provisions the workspace key itself; the skeleton is in `github-actions.md`.
3. Never fetch `Start9Labs/start-os/releases/latest` for `start-cli`; the `start-cli/*` releases live in `Start9Labs/start-technologies`.
4. Build arm packages on an arm runner (`ubuntu-24.04-arm`), not under QEMU.

## Local development requirements

For local package work, install/verify:

- Docker (running)
- Make, git, jq
- Node.js v22 or newer with npm
- SquashFS tools
- Start CLI, and a packaging workspace (`start-cli s9pk init-workspace`)

See [Environment Setup](./environment-setup.md). Local TypeScript checks run with `npm install && npm run check`; a full `.s9pk` build (`make x86`) requires the complete toolchain and the workspace.

## Documentation map

1. [Environment Setup](./environment-setup.md)
2. [Quick Start](./quick-start.md)
3. [Project Structure](./project-structure.md)
4. [Manifest](./manifest-ts.md)
5. [main.ts Patterns](./main-ts.md)
6. [interfaces.ts Patterns](./interfaces-ts.md)
7. [Initialization Patterns](./init.md)
8. [Actions](./actions.md)
9. [File Models](./file-models.md)
10. [Cross-Service Dependencies](./cross-service-dependencies.md)
11. [Versioning](./versions.md)
12. [Makefile](./makefile.md)
13. [GitHub Actions CI](./github-actions.md)
14. [Writing READMEs](./writing-readmes.md)

## Safety policy

Agents using this guide should prepare branches, PRs, and build artifacts. They should not install, sideload, update, or restart a live StartOS service unless the human explicitly approves that specific action.

## Start CLI release lookup pitfall

Do not install `start-cli` from `Start9Labs/start-os/releases/latest`: that repository may publish non-CLI release families such as `start-wrt/*`, leaving the `start-cli_x86_64-linux` asset lookup empty and causing `curl: (3) URL rejected: Malformed input to a URL function`.

Locally, use the official installer: `curl -fsSL https://start9.com/start-cli/install.sh | sh`. In CI, use `Start9Labs/start-technologies/.github/actions/setup-build-env@master`, which resolves the newest `start-cli` asset from the `start-technologies` releases itself. The pinned-asset script is in [GitHub Actions CI](./github-actions.md).

## Worked example

[bitcoinRph/crm-startos](https://github.com/bitcoinRph/crm-startos) packages a Bun/Next.js/NestJS monorepo with a PostgreSQL sidecar, a password sign-in, a cron replacement and an MCP endpoint, as `deploy/startos/` inside the upstream fork. Its `README.md`, `main.ts` and workflow are the reference for a package that must build the upstream from source.
