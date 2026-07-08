# AI Service Packaging

An AI-assisted toolkit for packaging self-hosted services for [StartOS](https://start9.com). This repo contains documentation, templates, and a `CLAUDE.md` that teaches Claude Code how to package any open-source project as a StartOS `.s9pk`.

## How It Works

When you run Claude Code in a directory that references this repo's `CLAUDE.md`, it learns the full StartOS packaging workflow — manifest configuration, daemon setup, networking, actions, dependencies, and more. You just tell it what service you want to package.

## Getting Started

1. Create a directory for your services and `cd` into it:

   ```sh
   mkdir services && cd services
   ```

2. Clone this repo:

   ```sh
   git clone https://github.com/bitcoinRph/ai-service-packaging.git ai-service-packaging
   ```

3. Copy the root `CLAUDE.md` into your services directory:

   ```sh
   cp ai-service-packaging/ROOT_CLAUDE.md CLAUDE.md
   ```

4. Run Claude Code and say hi:

   ```sh
   claude
   ```

   ```
   > hi
   ```

Claude will introduce itself, check for any pending tasks, and ask what you'd like to do — including packaging a new service. You can give it a repo URL, a project name, a product you want a self-hosted alternative to, or just describe what you need.

## Current StartOS build requirements

StartOS packaging now expects a packaging **workspace** around package repositories. Before running `make` or `start-cli s9pk pack` from a package checkout, initialize the parent workspace:

```sh
start-cli s9pk init-workspace .      # run once in the workspace directory
# or, from inside <workspace>/<package-repo>:
start-cli s9pk init-workspace ..
```

For GitHub Actions, do not fetch `start-cli` from `Start9Labs/start-os/releases/latest`; that latest release may be for another StartOS component. Use the `start-cli/*` release lookup documented in [GitHub Actions CI](./github-actions.md).
