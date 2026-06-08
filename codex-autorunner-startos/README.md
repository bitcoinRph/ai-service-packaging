# Codex Autorunner on StartOS

> **Upstream repo:** <https://github.com/Git-on-my-level/codex-autorunner>
> **Upstream docs:** <https://github.com/Git-on-my-level/codex-autorunner/tree/main/docs>
>
> Everything not listed in this document should behave the same as upstream
> Codex Autorunner (CAR) **2.1.2**. If a feature, setting, or behavior is not
> mentioned here, the upstream documentation is accurate and fully applicable.

Codex Autorunner (CAR) is a meta-harness that coordinates coding agents (Codex,
Hermes, OpenCode, and any [ACP](https://github.com/zed-industries/agent-client-protocol)-compatible
agent) so they can work through a queue of markdown "tickets" while you are
away. This package runs the CAR **hub** and its web control plane as a StartOS
service.

> ⚠️ **CAR is a privileged remote-control surface.** Anyone who can reach the
> web UI can run arbitrary code and modify files on your server. Treat the login
> link like a root password.

---

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Configuration Management](#configuration-management)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Actions](#actions)
- [Backups and Restore](#backups-and-restore)
- [Health Checks](#health-checks)
- [Limitations and Differences](#limitations-and-differences)
- [What Is Unchanged from Upstream](#what-is-unchanged-from-upstream)
- [Contributing](#contributing)
- [Quick Reference for AI Consumers](#quick-reference-for-ai-consumers)

---

## Image and Container Runtime

Upstream does not publish an official image for the hub server, so this package
builds a **custom multi-stage image**:

| Aspect       | Detail                                                                     |
| ------------ | -------------------------------------------------------------------------- |
| Web UI build | Stage 1 builds the Svelte web UI (`pnpm web:build`) into `web_static`      |
| Runtime      | Stage 2 is `python:3.11-slim`, `pip install`s the package, adds `git`/`tini` |
| Architectures | `x86_64`, `aarch64`                                                        |
| Entrypoint   | `tini --`; the service command is `car hub serve` (see `startos/main.ts`)  |

`git` is installed because CAR clones and manages git repositories at runtime.

## Volume and Data Layout

A single `main` volume is mounted at `/data` and holds **all** persistent state:

| Path                                   | Contents                                              |
| -------------------------------------- | ----------------------------------------------------- |
| `/data/hub`                            | CAR hub root (manifest, repos, tickets, PMA state)    |
| `/data/hub/.codex-autorunner/`         | Hub config, bootstrap token, browser sessions         |
| `/data/.codex-autorunner`              | Global CAR state root (`CAR_GLOBAL_STATE_ROOT`)       |
| `/data/.codex`                         | Codex CLI home (`CODEX_HOME`)                          |

`HOME` is set to `/data` so nothing is written to the ephemeral container
filesystem.

## Installation and First-Run Flow

1. On every start the wrapper runs `car init --mode hub --path /data/hub`
   (idempotent — it only seeds files that don't already exist).
2. The wrapper regenerates `/data/hub/.codex-autorunner/config.yml` with the
   service's current StartOS hostnames before launching the server (see
   [Configuration Management](#configuration-management)).
3. `car hub serve` binds to `0.0.0.0:4173`. Because it binds a non-loopback
   host with no bearer token, CAR writes a one-time **bootstrap token** to
   `/data/hub/.codex-autorunner/bootstrap-token`.
4. An install task prompts you to run the **Get Login Link** action, which
   returns ready-to-open `https://<host>/auth/bootstrap#token=<token>` URLs.

CAR has **no username/password**: first browser login is the bootstrap link,
which sets a session cookie. The token is single-use and rotates on restart.

## Configuration Management

| StartOS-Managed (do not edit)                          | Upstream-Managed (via CAR UI / config)            |
| ------------------------------------------------------ | ------------------------------------------------- |
| `server.host`, `server.port`, `server.base_path`       | Agents (Codex, Hermes, OpenCode), tickets, repos  |
| `server.allowed_hosts`, `server.allowed_origins`       | Telegram / Discord notifiers                      |
| `HOME`, `CAR_GLOBAL_STATE_ROOT`, `CODEX_HOME` env vars | Everything else in `codex-autorunner.yml`         |
| `FORWARDED_ALLOW_IPS=*` (trust the StartOS TLS proxy)  |                                                   |

The wrapper writes the highest-precedence override file
(`.codex-autorunner/config.yml`) on each boot, filling `allowed_hosts` and
`allowed_origins` with the service's `.local`, `.onion`, and LAN addresses so
CAR's TrustedHost/CORS checks accept StartOS traffic. **Editing that file by
hand will not persist** — change behavior in `codex-autorunner.yml` instead.

## Network Access and Interfaces

| Interface | ID   | Port   | Protocol | Purpose                  |
| --------- | ---- | ------ | -------- | ------------------------ |
| Web UI    | `ui` | `4173` | HTTP     | CAR hub control plane    |

Reachable over LAN IP, `.local` (HTTPS via the StartOS LAN cert), and Tor
`.onion`, like any StartOS UI interface.

## Actions

| Action            | ID               | Availability  | Purpose                                                                |
| ----------------- | ---------------- | ------------- | --------------------------------------------------------------------- |
| Get Login Link    | `get-login-link` | Only running  | Returns the current one-time bootstrap login URL(s) for the web UI    |

The login link is masked, copyable, and rendered as a QR code. If the token has
already been claimed or expired, the action explains how to issue a new one
(restart the service).

## Backups and Restore

The entire `main` volume is backed up, so the hub, all registered repos,
tickets, PMA state, and credentials are preserved. On restore, the install task
re-prompts for the login link (a fresh bootstrap token is issued on next boot).

## Health Checks

| Check         | Method                          | Success / Failure messages                                        |
| ------------- | ------------------------------- | ----------------------------------------------------------------- |
| Web Interface | TCP port-listening check (4173) | "The web interface is ready" / "The web interface is not ready"   |

## Limitations and Differences

1. **No bundled coding agents.** The image ships the CAR hub only. You must add
   and configure agents (Codex, Hermes, OpenCode) and any API keys from inside
   the UI after installing.
2. **Single-user / single-trust-level.** CAR has no multi-user auth or roles; a
   valid browser session is equivalent to admin access (upstream behavior).
3. **Secure-cookie + bootstrap auth require an HTTPS scheme.** The wrapper sets
   `FORWARDED_ALLOW_IPS=*` so uvicorn trusts the StartOS proxy's
   `X-Forwarded-Proto`. Use the `.local` (HTTPS) or `.onion` address for first
   login; plain-HTTP LAN-IP access may reject the remote bootstrap claim.
4. **Hub mode only.** This package runs `car hub serve`; the per-repo "app"
   server mode is not exposed separately.
5. **Docker-per-repo agent runtimes are not available**, since the service
   itself runs inside a StartOS container without a nested Docker daemon.

## What Is Unchanged from Upstream

- The CAR hub web UI, API, CLI (`car ...` inside the container), tickets,
  ticket-flow, PMA, and managed-thread features.
- Hub/repo/worktree management and the `codex-autorunner.yml` config contract.
- Telegram / Discord notification setup (configured from the UI).
- The web security model documented in `docs/web/security.md`.

## Contributing

Build instructions live in [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## Quick Reference for AI Consumers

```yaml
package_id: codex-autorunner
upstream_version: 2.1.2
image: custom (multi-stage; python:3.11-slim + prebuilt Svelte web_static)
architectures: [x86_64, aarch64]
volumes:
  main: /data
ports:
  ui: 4173
dependencies: none
startos_managed_env_vars:
  - HOME
  - CAR_GLOBAL_STATE_ROOT
  - CODEX_HOME
  - FORWARDED_ALLOW_IPS
actions:
  - get-login-link
```
