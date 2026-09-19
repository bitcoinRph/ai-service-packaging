# Environment Setup

## Prerequisites

You must have a computer running StartOS to test packages. Follow the [flashing guide](https://docs.start9.com/flashing-guides/) to install StartOS on a physical device or VM.

## Required Tools

### Docker

Docker is essential for building and managing container images that will be used for the final `.s9pk` build. It handles pulling base images and building custom container images from Dockerfiles.

**Installation**: Follow the [official Docker installation guide](https://docs.docker.com/engine/install/).

### Make

Build automation tool used to execute build scripts defined in Makefiles and coordinate the packaging workflow (building and installing s9pk binaries to StartOS).

**Installation**:
- **Linux (Debian-based)**: `sudo apt install build-essential`
- **macOS**: `xcode-select --install`

### Node.js v22 or newer

Node.js is required for compiling TypeScript code used in StartOS package configurations. Some upstream builds need more: an image that runs the upstream's own toolchain inside `docker build` picks its own Node there and is unaffected.

**Installation**: Use [nvm](https://github.com/nvm-sh/nvm) or download from [nodejs.org](https://nodejs.org/).

```bash
# Using nvm
nvm install 22
nvm use 22
```

### SquashFS

Tool for creating compressed filesystem images for packaging compiled service code.

**Installation**:
- **Linux (Debian-based)**: `sudo apt install squashfs-tools squashfs-tools-ng`
- **macOS**: `brew install squashfs` (requires Homebrew)

### Start CLI

The core development toolkit that provides package validation, s9pk file creation, and development workflow management.

**Local installation**: Run the official installer:

```bash
curl -fsSL https://start9.com/start-cli/install.sh | sh
```

**CI installation**: GitHub Actions should not download from `Start9Labs/start-os/releases/latest`, because the latest release can be for another StartOS component and may not contain `start-cli_x86_64-linux`. Instead, resolve the latest `start-cli/*` release from `Start9Labs/start-technologies`:

```bash
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
```

See [GitHub Actions CI](./github-actions.md) for the complete workflow skeleton.

### Packaging workspace

`start-cli` signs packages with a **workspace** key, so every package must live under a workspace: the directory that contains package repos, marked by `.startos/build.key.pem` (and a `config.yaml` with host and registry profiles). Create it once, in a directory that is not itself a package repo:

```bash
start-cli s9pk init-workspace start9-workspace
```

This also clones `Start9Labs/start-technologies` into `start9-workspace/start-technologies/`, whose `projects/start-sdk/docs/src/` is the official packaging guide, and writes `AGENTS.md` / `CLAUDE.md` so an AI assistant opened there knows the rules. Re-running `init-workspace` fills in anything missing and never overwrites your key. `start-cli` walks up from the current directory to find the nearest `.startos/`, so nested workspaces work and a package inside a larger repository (for example `deploy/startos/`) finds the workspace beside that repository.

Refresh the guide at the start of a session with `git -C start-technologies pull --ff-only`.

## Verification

After installation, verify all tools are available:

```bash
docker --version
make --version
node --version
mksquashfs -version
start-cli --version
```
