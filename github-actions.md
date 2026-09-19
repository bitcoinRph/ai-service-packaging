# GitHub Actions CI for StartOS packages

This is the current CI pattern for building StartOS `.s9pk` artifacts on GitHub-hosted runners with SDK 2.x.

## Why this pattern exists

- Start9's tooling lives in `Start9Labs/start-technologies`. That repository's *latest* release may be for another component (`start-wrt/...`), so never fetch `Start9Labs/start-os/releases/latest` and assume it contains `start-cli_x86_64-linux`.
- `start-cli s9pk pack` needs a packaging **workspace**: a `.startos/` directory with a `build.key.pem` signing key in the package directory or a parent. A bare CI checkout has none.
- `s9pk.mk` ships inside `@start9labs/start-sdk`, so `npm ci` must run before `make` can even parse the Makefile.

## Prefer the official reusable workflows

A package that lives at the root of its own repository should use Start9's reusable workflows exactly as the SDK template ships them:

```yaml
# .github/workflows/build.yml
name: Build
on:
  workflow_dispatch:
  pull_request:
    paths-ignore: ['*.md']
    branches: ['master']
jobs:
  build:
    if: github.event.pull_request.draft == false
    uses: Start9Labs/start-technologies/.github/workflows/build.yml@master
    secrets:
      DEV_KEY: ${{ secrets.DEV_KEY }}
```

That workflow installs the toolchain, provisions the workspace key, runs `npm ci`, discovers the build matrix from `make -s print-TARGETS`, builds arm targets natively on `ubuntu-24.04-arm`, and uploads each `.s9pk` as an artifact. `tagAndRelease.yml` and `release.yml` in the template publish to a registry and need `RELEASE_REGISTRY`, `S3_S9PKS_BASE_URL` and the S3 secrets.

## A package inside another repository

When the package is a subdirectory (for example `deploy/startos/` in an upstream fork), the reusable workflow cannot be pointed at it. Reuse Start9's composite action for the toolchain and do the rest yourself:

```yaml
name: StartOS package
on:
  workflow_dispatch:
  pull_request:
    paths: ['deploy/startos/**', 'Dockerfile', '.dockerignore']
defaults:
  run:
    working-directory: deploy/startos
jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - { target: x86, runner: ubuntu-latest }
          - { target: arm, runner: ubuntu-24.04-arm }
    runs-on: ${{ matrix.runner }}
    steps:
      - uses: actions/checkout@v6
      - uses: Start9Labs/start-technologies/.github/actions/setup-build-env@master
      - name: Provision a workspace signing key
        run: |
          start-cli init-key
          mkdir -p ../../.startos
          cp ~/.startos/id.key.pem ../../.startos/build.key.pem
      - run: npm ci
      - run: make ${{ matrix.target }}
      - uses: actions/upload-artifact@v4
        with:
          name: package_${{ matrix.target }}
          path: deploy/startos/*.s9pk
          if-no-files-found: error
```

`setup-build-env` installs Node 22, Docker with Buildx and QEMU, SquashFS tools and the newest `start-cli` from the `start-technologies` releases. Build arm on an arm runner: emulating a large image build under QEMU takes far longer than the job limit allows.

## Installing start-cli by hand

Outside CI, use the official installer:

```sh
curl -fsSL https://start9.com/start-cli/install.sh | sh
```

In a script that must pin the asset itself, resolve the newest `start-cli/*` release from `Start9Labs/start-technologies` and fail clearly when the asset is missing:

```sh
url="$(curl -fsSL 'https://api.github.com/repos/Start9Labs/start-technologies/releases?per_page=30' \
  | jq -r '[.[] | select(.tag_name | startswith("start-cli/")) | .assets[] | select(.name == "start-cli_x86_64-linux") | .browser_download_url][0] // empty')"
[ -n "$url" ] || { echo "start-cli_x86_64-linux not found" >&2; exit 1; }
curl -fsSL "$url" -o "$HOME/.local/bin/start-cli" && chmod +x "$HOME/.local/bin/start-cli"
```

## Common failures

### `curl: (3) URL rejected: Malformed input to a URL function`

The workflow resolved an empty URL because it queried a release without the `start-cli_x86_64-linux` asset. Use the `start-cli/*` query above.

### `No packaging workspace found` / a message pointing at `init-workspace`

`s9pk pack` found no `.startos/build.key.pem` walking up from the package directory. Provision one as in the workflows above.

### `Network Error: Failed to resolve hostname: dev-vm.local`

An older `init-workspace` wrote `host.default: https://dev-vm.local` into `config.yaml` and an older `start-cli` resolved it even for local packing. Current SDK 2.x `s9pk.mk` runs `start-cli s9pk pack` without a host, and the workspace key provisioned by hand carries no `config.yaml`. If it recurs, pass `-H http://localhost` to build-only `start-cli` commands, never to `install` or `publish`.

### The image build needs the network

A `dockerBuild` image that runs the upstream's own build (for example `bun run build` in a monorepo) may reach package registries or vendor APIs during `docker buildx build`. GitHub runners have the network; a sandboxed local machine may not.
