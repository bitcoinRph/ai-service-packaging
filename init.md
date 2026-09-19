# Initialization Patterns

## Overview

`setupOnInit` runs during container initialization. Name each init file for what it does (`init/seedSecrets.ts`, `init/watchCredentials.ts`), not `initializeService.ts`. The `kind` parameter indicates why init is running:

| Kind | When | Use For |
|------|------|---------|
| `'install'` | Fresh install | Generate internal secrets, seed file models, create the credentials task |
| `'update'` | After a version upgrade | Re-apply config, post-migration setup |
| `'restore'` | Restoring from backup | Re-register triggers; secrets come back with the store |
| `null` | Container rebuild, server restart | Register long-lived triggers (e.g., `.const()` watchers) |

Official reference: `start-technologies/projects/start-sdk/docs/src/init.md`, with the credentials recipe at `recipe-admin-credentials.md`.

## Init Kinds

### Install Only

For one-time setup that generates new state:

```typescript
export const seedSecrets = sdk.setupOnInit(async (effects, kind) => {
  await storeJson.merge(effects, {})   // every .catch() default, on every init

  if (kind !== 'install') return

  await storeJson.merge(effects, {
    secretKey: utils.getDefaultString({ charset: 'a-z,A-Z,0-9', len: 64 }),
  })
})
```

Internal secrets (database password, signing keys) are generated here. A credential the **user** signs in with is not: pair a `setupOnInit` watcher with a `set-admin-credentials` action, so one action generates, stores, returns and later rotates it:

```typescript
// init/watchCredentials.ts
export const watchCredentials = sdk.setupOnInit(async (effects) => {
  const admin = await storeJson.read((s) => s.adminPassword).const(effects)

  if (!admin) {
    await sdk.action.createOwnTask(effects, setAdminPassword, 'critical', {
      reason: i18n('Set the admin password before signing in'),
    })
  }
})
```

### Restore

For setup that should also run when restoring from backup (but not on container rebuild):

```typescript
export const reRegisterWebhook = sdk.setupOnInit(async (effects, kind) => {
  if (kind === null) return  // Skip on container rebuild

  // Runs on install, update and restore
  await registerWebhook(effects)
})
```

### Always (Container Lifetime)

For registering `.const()` triggers that need to persist for the container's lifetime. These re-register on container rebuild:

```typescript
export const registerWatchers = sdk.setupOnInit(async (effects, kind) => {
  // Runs on install, update, restore, AND container rebuild

  // Register a watcher that lives for the container lifetime
  someConfig.read((c) => c.setting).const(effects)

  // Install-specific setup
  if (kind === 'install') {
    await storeJson.merge(effects, {
      secretKey: utils.getDefaultString({ charset: 'a-z,A-Z,0-9', len: 64 }),
    })
  }
})
```

## Basic Structure

```typescript
// init/seedSecrets.ts
import { utils } from '@start9labs/start-sdk'
import { storeJson } from '../fileModels/store.json'
import { sdk } from '../sdk'

export const seedSecrets = sdk.setupOnInit(async (effects, kind) => {
  await storeJson.merge(effects, {})

  if (kind !== 'install') return

  await storeJson.merge(effects, {
    postgresPassword: utils.getDefaultString({ charset: 'a-z,A-Z,0-9', len: 32 }),
  })
})
```

## Registering init functions

Append them to `init/index.ts`. `restoreInit` and `versionGraph` stay first and second; a function that creates tasks must come after `actions`:

```typescript
import { sdk } from '../sdk'
import { setDependencies } from '../dependencies'
import { setInterfaces } from '../interfaces'
import { versionGraph } from '../versions'
import { actions } from '../actions'
import { restoreInit } from '../backups'
import { seedSecrets } from './seedSecrets'
import { watchCredentials } from './watchCredentials'

export const init = sdk.setupInit(
  restoreInit,
  versionGraph,
  setInterfaces,
  setDependencies,
  actions,
  seedSecrets,
  watchCredentials,
)

export const uninit = sdk.setupUninit(versionGraph)
```

## runUntilSuccess Pattern

Use `runUntilSuccess(timeout)` to run daemons and oneshots during init, waiting for completion before continuing. This is essential for setup tasks that need a running server.

### Oneshots Only

For simple sequential tasks (like database migrations):

```typescript
await sdk.Daemons.of(effects)
  .addOneshot('migrate', {
    subcontainer: appSub,
    exec: { command: ['python', 'manage.py', 'migrate', '--noinput'] },
    requires: [],
  })
  .addOneshot('create-superuser', {
    subcontainer: appSub,
    exec: {
      command: ['python', 'manage.py', 'createsuperuser', '--noinput'],
      env: {
        DJANGO_SUPERUSER_USERNAME: 'admin',
        DJANGO_SUPERUSER_PASSWORD: adminPassword,
      },
    },
    requires: ['migrate'],
  })
  .runUntilSuccess(120_000)  // 2 minute timeout
```

### Daemon + Dependent Oneshot

For services that require calling an API after the server starts (e.g., bootstrapping via HTTP):

```typescript
await sdk.Daemons.of(effects)
  .addDaemon('server', {
    subcontainer: appSub,
    exec: { command: ['node', 'server.js'] },
    ready: {
      display: null,
      fn: () =>
        sdk.healthCheck.checkPortListening(effects, 8080, {
          successMessage: 'Server ready',
          errorMessage: 'Server not ready',
        }),
    },
    requires: [],
  })
  .addOneshot('bootstrap', {
    subcontainer: appSub,
    exec: {
      command: [
        'node',
        '-e',
        `fetch('http://127.0.0.1:8080/api/bootstrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: '${adminPassword}' })
        }).then(r => {
          if (!r.ok) throw new Error('Bootstrap failed');
          process.exit(0);
        }).catch(e => {
          console.error(e);
          process.exit(1);
        })`,
      ],
    },
    requires: ['server'],  // Waits for daemon to be healthy
  })
  .runUntilSuccess(120_000)
```

**How it works:**
1. The daemon starts and runs its health check
2. Once healthy, the dependent oneshot executes
3. When the oneshot completes successfully, `runUntilSuccess` returns
4. All processes are cleaned up automatically

### Making HTTP Calls Without curl

Many slim Docker images don't have curl. Use the runtime's built-in HTTP capabilities:

**Node.js (v18+):**
```typescript
command: [
  'node',
  '-e',
  `fetch('http://127.0.0.1:${port}/api/endpoint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'value' })
  }).then(r => r.ok ? process.exit(0) : process.exit(1))
    .catch(() => process.exit(1))`,
]
```

**Python:**
```typescript
command: [
  'python',
  '-c',
  `import urllib.request, json
req = urllib.request.Request(
  'http://127.0.0.1:${port}/api/endpoint',
  data=json.dumps({'key': 'value'}).encode(),
  headers={'Content-Type': 'application/json'},
  method='POST'
)
urllib.request.urlopen(req)`,
]
```

## Common Patterns

### Generate Random Password

```typescript
import { utils } from '@start9labs/start-sdk'

const password = utils.getDefaultString({
  charset: 'a-z,A-Z,0-9',
  len: 22,
})
```

### Create User Task

Prompt user to run an action after install:

```typescript
await sdk.action.createOwnTask(effects, setAdminPassword, 'critical', {
  reason: i18n('Set the admin password before signing in'),
})
```

Severity levels: `'critical'` (blocks the service from starting), `'important'`, `'optional'`. Tasks are idempotent on `<package-id>:<action-id>`, so a watcher may call this on every init.

### Checking Init Kind

```typescript
export const seedFiles = sdk.setupOnInit(async (effects, kind) => {
  // kind === 'install': Fresh install
  // kind === 'update': After a version upgrade
  // kind === 'restore': Restoring from backup
  // kind === null: Container rebuild / server restart

  if (kind === 'install') {
    // Generate internal secrets, bootstrap server
  }

  if (!kind) return
  // Reached only on install, update or restore (skips container rebuild)
})
```
