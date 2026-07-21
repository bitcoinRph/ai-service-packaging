# GitHub Actions CI for StartOS packages

This is the current CI pattern for building StartOS `.s9pk` artifacts on GitHub-hosted runners.

## Why this pattern exists

Start9 moved the StartOS tooling releases under `Start9Labs/start-technologies`, and the repository's latest release may be for a component other than `start-cli` (for example `start-wrt/...`). Do **not** fetch `Start9Labs/start-os/releases/latest` and assume it contains `start-cli_x86_64-linux`.

Newer `start-cli` also requires a packaging **workspace**: the directory that contains the package repo and the packaging guide checkout. Running `start-cli -H http://localhost s9pk pack` directly inside an uninitialized package checkout can fail with:

```text
Uninitialized: No packaging workspace found
```

## Required CI rules

1. Install `start-cli` from the latest `start-cli/*` release in `Start9Labs/start-technologies`.
2. Fail clearly if `start-cli_x86_64-linux` cannot be resolved.
3. Run `start-cli s9pk init-workspace ..` before `make` when the checkout path is `<workspace>/<package-repo>`.
4. Run package builds from the package repo directory after workspace initialization.
5. Ensure CI build-only pack commands do not inherit the generated `host.default: https://dev-vm.local`; either pass `-H http://localhost` to `start-cli ... s9pk pack` in build plumbing or patch vendored `s9pk.mk` accordingly.

## Minimal workflow steps

Use this in package repos that build `.s9pk` artifacts:

```yaml
- name: Install Start CLI
  run: |
    mkdir -p "$HOME/.local/bin"
    url="$(curl -fsSL 'https://api.github.com/repos/Start9Labs/start-technologies/releases?per_page=20' \
      | jq -r '[.[] | select(.tag_name | startswith("start-cli/")) | .assets[] | select(.name == "start-cli_x86_64-linux") | .browser_download_url][0] // empty')"
    if [ -z "$url" ]; then
      echo "Unable to find start-cli_x86_64-linux in Start9Labs/start-technologies start-cli releases" >&2
      exit 1
    fi
    curl -fsSL "$url" -o "$HOME/.local/bin/start-cli"
    chmod +x "$HOME/.local/bin/start-cli"
    echo "$HOME/.local/bin" >> "$GITHUB_PATH"

- name: Initialize StartOS developer key
  run: start-cli init-key

- name: Initialize StartOS packaging workspace
  run: start-cli s9pk init-workspace ..

- name: Build package
  run: make x86_64
```

## Full workflow skeleton

```yaml
name: Package

on:
  workflow_dispatch:
  push:
    branches: ["master"]
    paths-ignore: ["*.md"]

jobs:
  package:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Checkout
        uses: actions/checkout@v6.0.2
        with:
          submodules: recursive

      - name: Setup Node
        uses: actions/setup-node@v6.4.0
        with:
          node-version: "22"
          cache: "npm"

      - name: Install packaging tools
        run: |
          sudo apt-get update
          sudo apt-get install -y make buildah fuse-overlayfs slirp4netns uidmap squashfs-tools squashfs-tools-ng jq

      - name: Configure Docker Buildx
        run: |
          docker buildx create --name startos-builder --driver docker-container --use
          docker buildx inspect --bootstrap

      - name: Configure container registries
        run: |
          sudo mkdir -p /etc/containers/registries.conf.d
          printf 'unqualified-search-registries = ["docker.io"]\n' | sudo tee /etc/containers/registries.conf.d/99-dockerio.conf

      - name: Install Start CLI
        run: |
          mkdir -p "$HOME/.local/bin"
          url="$(curl -fsSL 'https://api.github.com/repos/Start9Labs/start-technologies/releases?per_page=20' \
            | jq -r '[.[] | select(.tag_name | startswith("start-cli/")) | .assets[] | select(.name == "start-cli_x86_64-linux") | .browser_download_url][0] // empty')"
          if [ -z "$url" ]; then
            echo "Unable to find start-cli_x86_64-linux in Start9Labs/start-technologies start-cli releases" >&2
            exit 1
          fi
          curl -fsSL "$url" -o "$HOME/.local/bin/start-cli"
          chmod +x "$HOME/.local/bin/start-cli"
          echo "$HOME/.local/bin" >> "$GITHUB_PATH"

      - name: Initialize StartOS developer key
        run: start-cli init-key

      - name: Initialize StartOS packaging workspace
        run: start-cli s9pk init-workspace ..

      - name: Build package
        run: make x86_64
```

## Common failures

### `curl: (3) URL rejected: Malformed input to a URL function`

Cause: the workflow resolved an empty URL because it queried a release that does not contain the `start-cli_x86_64-linux` asset.

Fix: use the `Start9Labs/start-technologies` `start-cli/*` release query above and guard against an empty URL.

### `Uninitialized: No packaging workspace found`

Cause: newer `start-cli` expects the parent workspace to be initialized before packing.

Fix: run this from inside the package checkout before `make`:

```bash
start-cli s9pk init-workspace ..
```

### `start-cli: command not found`

Cause: `$HOME/.local/bin` was not added to `GITHUB_PATH` after downloading `start-cli`.

Fix: keep `echo "$HOME/.local/bin" >> "$GITHUB_PATH"` in the install step.
### `Network Error: Failed to resolve hostname: dev-vm.local`

Cause: `start-cli s9pk init-workspace` writes a development host profile (`host.default: https://dev-vm.local`) into the workspace config. Newer `start-cli` initializes `CliContext` even for local `s9pk` commands, so CI runners without mDNS for `dev-vm.local` can fail before Docker/buildx starts.

Fix: build-only commands should override the host with `-H http://localhost`, for example `start-cli -H http://localhost s9pk pack --arch=x86_64 -o package_x86_64.s9pk`, or patch vendored `s9pk.mk` pack/list-ingredients invocations. Do not use this override for `install` or `publish`; those intentionally target configured hosts/registries.
