# manifest/

The manifest defines service identity, metadata, and build configuration. It lives in `startos/manifest/` as two files:

- `index.ts` — the `setupManifest()` call
- `i18n.ts` — translated strings for `description`

**When**: Always - defines service identity and metadata. Official reference: `start-technologies/projects/start-sdk/docs/src/manifest.md`.

## File: manifest/i18n.ts

Locale objects for user-facing manifest strings. Each is a record of locale → string. `short` is limited to 120 characters (about 80 fit the marketplace tile), `long` to 2000:

```typescript
export const short = {
  en_US: 'Brief description (one line)',
  es_ES: 'Descripción breve (una línea)',
  de_DE: 'Kurze Beschreibung (eine Zeile)',
  pl_PL: 'Krótki opis (jedna linia)',
  fr_FR: 'Description brève (une ligne)',
}

export const long = {
  en_US: 'Longer description explaining what the service does and its key features.',
  es_ES: 'Descripción más larga que explica qué hace el servicio y sus características principales.',
  de_DE: 'Längere Beschreibung, die erklärt, was der Dienst tut und seine wichtigsten Funktionen.',
  pl_PL: 'Dłuższy opis wyjaśniający, co robi usługa i jej kluczowe funkcje.',
  fr_FR: 'Description plus longue expliquant ce que fait le service et ses fonctionnalités principales.',
}
```

## File: manifest/index.ts

```typescript
import { setupManifest } from '@start9labs/start-sdk'
import { long, short } from './i18n'

export const manifest = setupManifest({
  id: 'my-service',
  title: 'My Service',
  license: 'MIT',
  packageRepo: 'https://github.com/bitcoinRph/my-service-startos',
  upstreamRepo: 'https://github.com/original/my-service',
  marketingUrl: 'https://example.com/',
  donationUrl: null,
  description: { short, long },
  volumes: ['main'],
  images: {
    /* see below */
  },
  dependencies: {},
})
```

## Required Fields

| Field               | Description                                                              |
|---------------------|--------------------------------------------------------------------------|
| `id`                | Unique identifier (lowercase, hyphens allowed; `start-os` is reserved)   |
| `title`             | Display name shown in UI                                                 |
| `license`           | SPDX identifier (`MIT`, `Apache-2.0`, `GPL-3.0`, etc.)                   |
| `packageRepo`       | URL to the StartOS package repository                                    |
| `upstreamRepo`      | URL to the original project repository                                   |
| `marketingUrl`      | URL for the project's main website                                       |
| `donationUrl`       | Donation URL or `null`                                                   |
| `description.short` | Locale object (see `manifest/i18n.ts`)                                   |
| `description.long`  | Locale object (see `manifest/i18n.ts`)                                   |
| `volumes`           | Storage volumes (usually `['main']`)                                     |
| `images`            | Docker image configuration (including `arch`)                            |
| `dependencies`      | Service dependencies                                                     |

Removed in SDK 2.0 and rejected by `setupManifest`: `wrapperRepo`, `supportSite`, `docsUrl`, `docsUrls` and `alerts`. Documentation links now belong in the package's `instructions.md`; StartOS no longer shows per-package lifecycle alerts.

## License

Check the upstream project's LICENSE file and use the correct SPDX identifier. Symlink the license from the submodule or fork, or copy it when wrapping a pre-built image:

```bash
ln -sf upstream-project/LICENSE LICENSE
```

## Icon

Symlink from upstream if available (svg, png, jpg, or webp, max 40 KiB). Fetch the real upstream asset; never ship an invented one:

```bash
ln -sf upstream-project/logo.svg icon.svg
```

## Images Configuration

Each image can include an `arch` field. It defaults to `['x86_64', 'aarch64', 'riscv64']` if omitted; list it explicitly and keep it aligned with `ARCHES` in the Makefile. Verify the image tag exists in the registry and ships both architectures before pinning it.

### Pre-built Docker Tag

```typescript
images: {
  main: {
    source: {
      dockerTag: 'nginx:1.25',
    },
    arch: ['x86_64', 'aarch64'],
  },
},
```

### Local Docker Build

`dockerBuild` runs `docker buildx build <workdir> -f <dockerfile> --platform linux/<arch> --build-arg ARCH=<arch>`. Both paths are relative to the package directory; `workdir` defaults to `.` and `dockerfile` to `<workdir>/Dockerfile`.

```typescript
// Dockerfile in the package root
images: {
  main: {
    source: {
      dockerBuild: {},
    },
    arch: ['x86_64', 'aarch64'],
  },
},
```

Upstream Dockerfile in a submodule:

```typescript
images: {
  main: {
    source: {
      dockerBuild: {
        workdir: './upstream-project',
      },
    },
    arch: ['x86_64', 'aarch64'],
  },
},
```

Package living inside an upstream fork (for example `deploy/startos/`), building from the repository root:

```typescript
images: {
  main: {
    source: {
      dockerBuild: { workdir: '../..', dockerfile: '../../Dockerfile' },
    },
    arch: ['x86_64', 'aarch64'],
  },
},
```

A non-standard Dockerfile name goes in `dockerfile`, again relative to the package directory. `buildArgs: { KEY: 'value' }` or `{ KEY: { env: 'VAR' } }` passes build arguments.

### Architecture Support

| Value     | Architecture     |
|-----------|------------------|
| `x86_64`  | Intel/AMD 64-bit |
| `aarch64` | ARM 64-bit       |
| `riscv64` | RISC-V 64-bit    |

### GPU/Hardware Acceleration

```typescript
images: {
  main: {
    source: { dockerTag: 'ollama/ollama:0.13.5' },
    arch: ['x86_64', 'aarch64'],
    nvidiaContainer: true,
  },
},
hardwareAcceleration: true,
```

Per-variant hardware requirements go in `hardwareRequirements.device`; every variant needs a distinct requirement. See the official manifest page.

### Multiple Images

```typescript
images: {
  app: {
    source: { dockerTag: 'myapp:1.2.3' },
    arch: ['x86_64', 'aarch64'],
  },
  postgres: {
    source: { dockerTag: 'postgres:17.11-alpine' },
    arch: ['x86_64', 'aarch64'],
  },
},
```

## Dependencies

Declare dependencies on other StartOS services. The `description` is a plain string, not a locale object:

```typescript
dependencies: {
  bitcoin: {
    description: 'Required for blockchain data',
    optional: false,
  },
  'c-lightning': {
    description: 'Needed for Lightning payments',
    optional: true,
    metadata: {
      title: 'Core Lightning',
      icon: 'https://raw.githubusercontent.com/Start9Labs/cln-startos/refs/heads/master/icon.png',
    },
  },
},
```

## Volumes

Storage volumes for persistent data. Prefer the upstream's own naming when it has one; `['main']` otherwise. For separate storage areas use several: `['main', 'db']`. Reference them in `main.ts` mounts by id.
