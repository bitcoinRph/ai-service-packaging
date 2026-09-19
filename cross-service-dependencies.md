# Cross-Service Dependencies

## When to Use

When your service depends on another StartOS service and needs to:
- Enforce configuration on the dependency (e.g. enable a feature)
- Register with the dependency (e.g. appservice registration)
- Read the dependency's interface URL at runtime

## Declaring Dependencies in manifest/index.ts

Dependencies require either `metadata` or `s9pk` to provide display info (title/icon). Both achieve the same result — they're two ways of providing the metadata:

```typescript
dependencies: {
  // Provide metadata directly
  synapse: {
    description: 'Needed for Matrix homeserver',
    optional: false,
    metadata: {
      title: 'Synapse',
      icon: '../synapse-wrapper/icon.png',
    },
  },

  // Extract metadata from an s9pk file
  electrs: {
    description: 'Provides an index for address lookups',
    optional: true,
    s9pk: 'https://github.com/org/repo/releases/download/v1.0/electrs.s9pk',
  },

  // s9pk: null when no s9pk URL is available
  'other-service': {
    description: 'Optional integration',
    optional: true,
    s9pk: null,
  },
}
```

## Cross-Service Task Creation (dependencies.ts)

Use `sdk.action.createTask()` to trigger an action on a dependency. The action must be exported from the dependency's package.

```typescript
import { i18n } from './i18n'
import { sdk } from './sdk'
import { someAction } from 'dependency-package/startos/actions/someAction'

export const setDependencies = sdk.setupDependencies(async ({ effects }) => {
  await sdk.action.createTask(effects, 'dependency-id', someAction, 'critical', {
    input: {
      kind: 'partial',
      value: { /* fields matching the action's input spec */ },
    },
    when: { condition: 'input-not-matches', once: false },
    reason: i18n('Human-readable reason shown to user'),
  })

  return {
    'dependency-id': {
      kind: 'running',
      versionRange: '>=1.0.0:0',
      healthChecks: [],
    },
  }
})
```

**API signature:**
```typescript
sdk.action.createTask(
  effects,
  packageId: string,         // dependency service ID
  action: ActionDefinition,  // imported from the dependency package
  severity: 'critical' | 'important' | 'optional',
  options?: {
    input?: { kind: 'partial', value: Partial<InputSpec> },
    when?: { condition: 'input-not-matches', once: boolean },
    reason: string,
    replayId?: string,       // prevents duplicate task execution
  }
)
```

**Key points:**
- Import the action object from the dependency's published package
- The dependency must be listed in your `package.json` (e.g. `"synapse-startos": "file:../synapse-wrapper"`)
- `when: { condition: 'input-not-matches', once: false }` re-triggers until the action's input matches
- `replayId` prevents duplicate tasks across restarts

## Reading Dependency Interfaces (main.ts)

Use `sdk.host.get()` to read a dependency's host at runtime (SDK 2.0 replaced `sdk.serviceInterface.get`):

```typescript
const url = await sdk.host
  .get(
    effects,
    { hostId: 'host-id', packageId: 'dependency-id' },
    (host) =>
      host?.bindings[8332]?.interfaces['interface-id']?.addressInfo.format('urlstring')[0] ?? null,
  )
  .const()  // re-runs setupMain if the dependency's host changes
```

**Alternative: the bridge address.** `sdk.host.getBridgeAddress(effects, { hostId, packageId, internalPort })` resolves the `10.0.3.1:<port>` address another package's binding is reachable at from your container, whichever way that package terminates TLS.

## Mounting Dependency Volumes (main.ts)

Mount a dependency's volume for direct file access:

```typescript
const mounts = sdk.Mounts.of()
  .mountVolume({ volumeId: 'main', subpath: null, mountpoint: '/data', readonly: false })
  .mountDependency({
    dependencyId: 'bitcoind',
    volumeId: 'main',
    subpath: null,
    mountpoint: '/mnt/bitcoind',
    readonly: true,
  })
```

## Init Order

Dependencies are resolved during init in this order:
```
restoreInit → versionGraph → setInterfaces → setDependencies → actions → setup
```

`setInterfaces` runs before `setDependencies`, so your service's interfaces are available when creating cross-service tasks.
