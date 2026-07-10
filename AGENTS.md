# Agent Packaging Guide Instructions

This repository is the maintained `bitcoinRph` Agent Packaging Guide for creating StartOS `.s9pk` service packages.

It is intentionally multi-agent:

- Claude Code can use `CLAUDE.md` directly.
- OpenAI Codex / Codex CLI should use this `AGENTS.md` file as the entry point.
- Hermes Agent should use this file when the repo is the working directory and may also load its `startos-ai-service-packaging` skill.
- OpenClaw should use this file or `CLAUDE.md`, depending on its workspace adapter.

## Mandatory startup

Before packaging, read `CLAUDE.md` in this repository. It is the canonical packaging reference and links to the detailed docs.

If this file has been copied into a parent workspace and the guide is checked out as `ai-service-packaging/`, read `ai-service-packaging/CLAUDE.md` instead.

## Scope

Use this guide to:

1. inspect an upstream open-source service;
2. map its runtime, ports, persistence, secrets, health checks, and auth into StartOS concepts;
3. create or update a `<service>-startos` package repo;
4. validate TypeScript with `npm run check`;
5. build `.s9pk` artifacts through GitHub Actions using `github-actions.md` unless local build tools are proven available;
6. open a reviewable PR with the package changes and artifact/build evidence.

## Build policy

Prefer repository GitHub Actions for `.s9pk` builds. Follow `github-actions.md` exactly:

- install `start-cli` from the latest `start-cli/*` release in `Start9Labs/start-technologies`;
- initialize the packaging workspace with `start-cli s9pk init-workspace ..` before `make`;
- do not fetch `Start9Labs/start-os/releases/latest` for `start-cli`.

Local builds are acceptable only when Docker/Buildah, SquashFS tools, Node.js v22, Make, and `start-cli` are installed and working.

## Safety rules

- Keep package diffs minimal and tied to the upstream service.
- Do not hardcode secrets.
- Do not install, sideload, update, or restart a live StartOS service unless the user explicitly approves that exact action.
- If a build or tool is unavailable, report the blocker and use GitHub Actions rather than inventing build output.
- Use conventional commits and open PRs for review.
