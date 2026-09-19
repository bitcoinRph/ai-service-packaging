# Makefile Build System

A StartOS package's `Makefile` carries only project-specific configuration and includes the shared build logic, `s9pk.mk`, which ships **inside** `@start9labs/start-sdk` since SDK 2.0. Nothing is vendored: bumping the SDK delivers build-system fixes.

## File Structure

```
my-service-startos/
└── Makefile     # Project-specific config; includes the SDK's s9pk.mk
```

## Makefile

```makefile
ARCHES := x86 arm
# overrides to s9pk.mk must precede the include statement
include node_modules/@start9labs/start-sdk/s9pk.mk
```

`ARCHES` must align with the `arch` fields in `manifest/index.ts`. Drop `arm` only if the upstream image is amd64-only; add `riscv` only if the image actually supports it.

### What s9pk.mk Provides

| Target               | Description                                          |
|----------------------|------------------------------------------------------|
| `make` or `make all` | Build for every architecture in `ARCHES`             |
| `make x86`           | Build for x86_64 only                                |
| `make arm`           | Build for aarch64 only                               |
| `make universal`     | Build a single package containing all architectures  |
| `make install`       | Install the most recent .s9pk to your StartOS server |
| `make clean`         | Remove build artifacts                               |
| `make print-TARGETS` | Print the build matrix (used by CI)                  |

Before packing, `s9pk.mk` runs the build gate: `npm run check` (tsc), the SDK lint runner (`node node_modules/@start9labs/start-sdk/lint.mjs`), `npx prettier --check startos`, then `npm run build` (ncc bundle to `javascript/index.js`).

### Variables

| Variable  | Default         | Description                              |
|-----------|-----------------|------------------------------------------|
| `ARCHES`  | `x86 arm riscv` | Architectures to build by default        |
| `TARGETS` | `$(ARCHES)`     | Leaf targets CI fans out over            |
| `VARIANT` | (unset)         | Optional variant suffix for package name |

### Adding Custom Targets

```makefile
TARGETS := generic rocm
ARCHES := x86 arm

include node_modules/@start9labs/start-sdk/s9pk.mk

.PHONY: generic rocm

generic:
	$(MAKE) all_arches VARIANT=generic

rocm:
	ROCM=1 $(MAKE) all_arches VARIANT=rocm ARCHES=x86_64
```

Each variant must declare a distinct `hardwareRequirements` entry in the manifest.

## Prerequisites

Building signs the package with a **workspace signing key**, so the package must live inside a packaging workspace: a parent directory holding `.startos/build.key.pem` (or a `schema:`-tagged `.startos/config.yaml`). `start-cli` walks up from the package directory to find it. Create one with `start-cli s9pk init-workspace <dir>` in the directory that will hold your package repos, never inside a package repo.

Without a workspace, `make` fails with a message pointing at `init-workspace`.

The build also needs Docker (running), `make`, Node.js 22+ with `npm`, `start-cli`, `git`, `jq` and SquashFS tools. See [Environment Setup](./environment-setup.md).

## Build Commands

```bash
make x86              # the fast path while developing: one architecture
make arm
make                  # every architecture in ARCHES
make universal        # one multi-arch package, for publishing
make clean x86        # chain targets
```

## Installation

`make install` uploads the most recently built `.s9pk` to the device named by `host.default` in the workspace's `.startos/config.yaml` (not `~/.startos/config.yaml`):

```yaml
host:
  default: https://your-device.local
```

Log in once with `start-cli auth login`, then `make x86 install`. Your machine must trust the device's certificate, or sideload the `.s9pk` through the StartOS web interface instead. Never run `make install` against a live server without the user's explicit approval.
