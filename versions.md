# Versioning

StartOS uses Extended Versioning (ExVer) to manage package versions, allowing downstream maintainers to release updates without upstream changes. The official reference is `start-technologies/projects/start-sdk/docs/src/versions.md` (<https://docs.start9.com/packaging/versions.html>); this page is the short form.

## Version Format

```
[#flavor:]<upstream>[-upstream-prerelease]:<downstream>
```

| Component             | Description                          | Example       |
|-----------------------|--------------------------------------|---------------|
| `flavor`              | Optional variant for diverging forks | `#libre:`     |
| `upstream`            | Upstream project version (SemVer)    | `26.0.0`      |
| `upstream-prerelease` | Upstream prerelease suffix           | `-beta.1`     |
| `downstream`          | StartOS wrapper revision             | `0`, `1`, `2` |

The downstream revision is always a plain integer. Prerelease suffixes appear only on the upstream side, when wrapping an upstream alpha, beta or rc.

### Flavor

Flavors are for diverging forks of a project that maintain separate version histories. Do NOT use flavors for hardware variants (like GPU types) - those are handled via build configuration (`VARIANT` in the Makefile).

### Examples

| Version String  | Upstream        | Downstream |
|-----------------|-----------------|------------|
| `26.0.0:0`      | 26.0.0 (stable) | 0          |
| `26.0.0-rc.1:0` | 26.0.0-rc.1     | 0          |
| `2.3.2:1`       | 2.3.2 (stable)  | 1          |

### Version Ordering

1. Upstream version (most significant)
2. Upstream prerelease (stable > rc > beta > alpha)
3. Downstream revision

## Choosing a Version

1. **Select the latest stable upstream version** - avoid prereleases unless necessary
2. **Match the Docker image tag** - `images.*.source.dockerTag` in `manifest/index.ts` must match the upstream version (for a `dockerBuild` from a submodule or fork, the checked-out upstream tag)
3. **Start downstream at 0** - increment only for wrapper-only changes

## File Structure

The latest version **always** lives in `startos/versions/current.ts`. The filename never changes as you bump; only its contents do. Historical versions are kept as their own files only when a later migration must upgrade *through* them.

```
startos/versions/
├── index.ts          # VersionGraph: imports current, lists historical versions in `other`
├── current.ts        # The latest version (always this filename)
└── v1.0.0_0.ts       # A historical version kept because it carries a migration
```

### current.ts Template

```typescript
import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: 'X.Y.Z:0',
  releaseNotes: {
    en_US: 'Initial release for StartOS',
    es_ES: 'Versión inicial para StartOS',
    de_DE: 'Erstveröffentlichung für StartOS',
    pl_PL: 'Pierwsze wydanie dla StartOS',
    fr_FR: 'Version initiale pour StartOS',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
```

### index.ts

```typescript
import { VersionGraph } from '@start9labs/start-sdk'
import { current } from './current'

export const versionGraph = VersionGraph.of({
  current,
  other: [],
})
```

### Historical Version File Naming

When a migration forces a version out of `current.ts`, rename the file after the version it holds: prefix `v`, replace `:` with `_`, keep the dots. Rename its export from `current` to the same name with every `.`, `:` and `-` replaced by `_`.

| Version         | Filename            | Export         |
|-----------------|---------------------|----------------|
| `26.0.0:0`      | `v26.0.0_0.ts`      | `v_26_0_0_0`   |
| `26.0.0-rc.1:0` | `v26.0.0-rc.1_0.ts` | `v_26_0_0_rc_1_0` |
| `2.3.2:1`       | `v2.3.2_1.ts`       | `v_2_3_2_1`    |

## Incrementing Versions

**No migration (the common case): edit `current.ts` in place.** Change `version` and `releaseNotes`. Do not rename the file, do not touch `index.ts`.

**Migration needed:** rename `current.ts` to its historical name, add that version to `other` in `index.ts`, then create a fresh `current.ts` with the new version and the `up`/`down` migration.

A released version is **not** a reason to add it to `other`; only a migration is. `VersionGraph` synthesizes a range vertex below `current`, so any older install migrates to `current` in one hop.

### Upstream Update

1. Update the git submodule (or fork checkout) to the new tag
2. Update `dockerTag` in `manifest/index.ts` (if using a pre-built image)
3. Edit `current.ts`: new upstream version, downstream reset to 0, release notes summarizing the upstream changelog with a link to it

### Wrapper-Only Changes

Keep the upstream version, increment the downstream revision, edit `current.ts` in place.

## Migrations

Migrations run when users update between versions, and only for data the upstream service does not migrate itself:

```typescript
migrations: {
  up: async ({ effects }) => {
    // Code to migrate from previous version
  },
  down: IMPOSSIBLE, // or an async function when rollback is possible
}
```

Use `IMPOSSIBLE` for initial versions and for breaking changes that cannot be reversed.

## Git Tag Conventions

Releases are tagged `v{upstream}_{downstream}`: `26.0.0:0` becomes `v26.0.0_0`. No package-name prefix; push tags individually.
