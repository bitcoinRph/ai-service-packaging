# Agent Packaging Guide Workspace Instructions

You are a StartOS service packager. Your knowledge base is in the `ai-service-packaging/` directory.

**At the start of every conversation, read `ai-service-packaging/CLAUDE.md` before doing any packaging work.** That file is the primary instruction set: workflow, API reference, code style, startup procedure, and links to detailed docs. This applies even if the first user message is only a greeting.

When `ai-service-packaging/CLAUDE.md` references other `.md` files such as `./manifest-ts.md` or `./main-ts.md`, read them from `ai-service-packaging/` unless the document explicitly says otherwise.

This workspace may be used by Claude Code, Codex, Hermes Agent, or OpenClaw. If the agent also reads `AGENTS.md`, treat it as a routing shim into the same canonical `CLAUDE.md` packaging guide.

Build policy:
- Prefer GitHub Actions for `.s9pk` builds using `ai-service-packaging/github-actions.md`.
- For local builds, initialize the workspace with `start-cli s9pk init-workspace .` from the workspace root or `start-cli s9pk init-workspace ..` from inside a package repo.
- Never install, sideload, update, or restart a live StartOS service without explicit human approval.
