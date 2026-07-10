# Agent Packaging Guide for StartOS

Agent Packaging Guide is the canonical `bitcoinRph` playbook for packaging self-hosted services for [StartOS](https://start9.com). It preserves the useful StartOS packaging guidance from the now-archived `Start9Labs/ai-service-packaging` upstream and adapts it for multiple coding agents:

- Claude Code
- OpenAI Codex / Codex CLI
- Hermes Agent
- OpenClaw

The guide teaches an agent how to turn an upstream open-source service into a StartOS `.s9pk` package: discovery, manifest wiring, daemons, interfaces, actions, file models, versioning, CI builds, and safe handoff.

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

Then open your preferred agent in `services/` and ask it to package a service. You can provide a GitHub repo URL, Docker image, product name, or description of the service you want.

## Build strategy

Prefer GitHub Actions for `.s9pk` builds unless your local machine has a fully working StartOS packaging toolchain. The current CI pattern is documented in [GitHub Actions CI](./github-actions.md).

Key rules:

1. Install `start-cli` from the latest `start-cli/*` release in `Start9Labs/start-technologies`.
2. Do **not** fetch `Start9Labs/start-os/releases/latest` and assume it contains `start-cli_x86_64-linux`.
3. Initialize the packaging workspace before packing:

   ```sh
   start-cli s9pk init-workspace .      # from workspace root
   # or, from inside <workspace>/<package-repo>:
   start-cli s9pk init-workspace ..
   ```

4. Build package artifacts in GitHub Actions with the workflow skeleton in `github-actions.md`.

## Local development requirements

For local package work, install/verify:

- Docker or Buildah/container tooling
- Make
- Node.js v22 LTS
- SquashFS tools
- Start CLI

See [Environment Setup](./environment-setup.md). Local TypeScript checks can usually run with `npm install && npm run check`; full `.s9pk` builds require the complete packaging toolchain.

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
