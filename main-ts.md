# main.ts Patterns

## Basic Structure

```typescript
import { writeFile } from 'node:fs/promises'
import { i18n } from './i18n'
import { sdk } from './sdk'
import { storeJson } from './fileModels/store.json'

export const main = sdk.setupMain(async ({ effects }) => {
  // 1. Read configuration (map to the fields you need; the daemons restart only when they change)
  const secretKey = await storeJson.read((s) => s.secretKey).const(effects)

  // 2. Get hostnames (for ALLOWED_HOSTS, CORS, trusted origins). Interfaces live on their host;
  //    'ui' is the id passed to sdk.MultiHost.of in interfaces.ts, 8080 the bound port.
  const allowedHosts =
    (await sdk.host
      .getOwn(effects, 'ui', (host) =>
        host?.bindings[8080]?.interfaces['ui']?.addressInfo
          .format('hostname-info')
          .map((h) => h.hostname),
      )
      .const()) ?? []

  // 3. Create subcontainer (lazy: no await needed)
  const appSub = sdk.SubContainer.of(
    effects,
    { imageId: 'my-service' },
    sdk.Mounts.of().mountVolume({
      volumeId: 'main',
      subpath: null,
      mountpoint: '/data',
      readonly: false,
    }),
    'my-service-sub',
  )

  // 4. Write config files to subcontainer rootfs (for ephemeral config)
  await writeFile(
    `${await appSub.rootfs}/app/config.py`,
    generateConfig({ secretKey: secretKey ?? '', allowedHosts }),
  )

  // 5. Define daemons and oneshots
  return sdk.Daemons.of(effects)
    .addOneshot('migrate', {
      subcontainer: appSub,
      exec: { command: ['python', 'manage.py', 'migrate', '--noinput'] },
      requires: [],
    })
    .addDaemon('main', {
      subcontainer: appSub,
      exec: { command: ['./start.sh'] },
      ready: {
        display: i18n('Web Interface'),
        fn: () =>
          sdk.healthCheck.checkPortListening(effects, 8080, {
            successMessage: i18n('Service is ready'),
            errorMessage: i18n('Service is not ready'),
          }),
      },
      requires: ['migrate'],
    })
})
```

## Reactive vs One-time Reads

When reading configuration in `main.ts`, you choose how the system responds to changes:

| Method | Returns | Behavior on Change |
|--------|---------|-------------------|
| `.once()` | Parsed content only | Nothing - value is stale |
| `.const(effects)` | Parsed content | Re-runs the `setupMain` context, restarting daemons |

```typescript
// Reactive: re-runs setupMain when value changes (restarts daemons)
const store = await storeJson.read().const(effects)

// One-time: read once, no re-run on change
const store = await storeJson.read().once()
```

### Subset Reading

Use a mapper function to read only specific fields. This is more efficient and limits reactivity to only the fields you care about:

```typescript
// Read entire store - re-runs if ANY field changes
const store = await storeJson.read().const(effects)

// Read only secretKey - re-runs only if secretKey changes
const secretKey = await storeJson.read((s) => s.secretKey).const(effects)
```

Never write an identity mapper (`.read((s) => s)`); omit the mapper for the whole object.

### Other Reading Methods

| Method | Purpose |
|--------|---------|
| `.onChange(effects, callback)` | Register callback for value changes |
| `.watch(effects)` | Create async iterator of new values |

## Getting Hostnames

SDK 2.0 removed `sdk.serviceInterface.*`. An exported interface lives on its **host**: `sdk.host.getOwn(effects, hostId)` returns the host, and the interface sits at `host.bindings[internalPort].interfaces[id]` with a pre-filled `addressInfo` carrying `format`, `filter`, `nonLocal`, `public` and `toUrl`:

```typescript
const host = await sdk.host.getOwn(effects, 'ui').const()
const ui = host?.bindings[8080]?.interfaces['ui']

const urls = ui?.addressInfo.nonLocal.format('urlstring') ?? []   // https://..., http://...
const names = ui?.addressInfo.format('hostname-info').map((h) => h.hostname) ?? []
const publicUrls = ui?.addressInfo.public.format('urlstring') ?? []
```

Pass a `map` selector to `getOwn` so `.const()` re-runs `setupMain` only when the mapped slice changes:

```typescript
const origins =
  (await sdk.host
    .getOwn(effects, 'ui', (host) =>
      host?.bindings[8080]?.interfaces['ui']?.addressInfo.nonLocal.format('urlstring'),
    )
    .const()) ?? []
```

## Oneshots (Runtime)

Tasks that run on every startup before daemons. Use for idempotent operations like migrations:

```typescript
.addOneshot('migrate', {
  subcontainer: appSub,
  exec: { command: ['python', 'manage.py', 'migrate', '--noinput'] },
  requires: [],
})
.addOneshot('collectstatic', {
  subcontainer: appSub,
  exec: { command: ['python', 'manage.py', 'collectstatic', '--noinput'] },
  requires: ['migrate'],
})
```

**Important**: Do NOT put one-time setup tasks (like `createsuperuser`) in main.ts oneshots - they run on every startup and will fail on subsequent runs. Use `init/index.ts` (`sdk.setupInit`) instead. See [Initialization Patterns](./init.md) for details.

## Exec Command

### Using Upstream Entrypoint

If the upstream Docker image has a compatible `ENTRYPOINT`/`CMD`, use `sdk.useEntrypoint()` instead of specifying a custom command. This is the simplest approach and ensures compatibility with the upstream image:

```typescript
.addDaemon('primary', {
  subcontainer: appSub,
  exec: {
    command: sdk.useEntrypoint(),
  },
  // ...
})
```

You can pass an array of arguments to override the image's `CMD` while keeping the `ENTRYPOINT`:

```typescript
.addDaemon('postgres', {
  subcontainer: postgresSub,
  exec: {
    command: sdk.useEntrypoint(['-c', 'random_page_cost=1.0']),
  },
  // ...
})
```

**When to use `sdk.useEntrypoint()`:**
- Upstream image has a working entrypoint that starts the service correctly
- You want to use the entrypoint but optionally override CMD arguments
- Examples: Ollama, Jellyfin, Vaultwarden, Postgres

### Custom Command

Use a custom command array when you need to bypass the entrypoint entirely:

```typescript
.addDaemon('primary', {
  subcontainer: appSub,
  exec: {
    command: ['/opt/app/bin/start.sh', '--port=' + uiPort],
  },
  // ...
})
```

## Environment Variables

```typescript
.addDaemon('main', {
  subcontainer: appSub,
  exec: {
    command: sdk.useEntrypoint(),  // or custom command
    env: {
      DATABASE_URL: 'sqlite:///data/db.sqlite3',
      SECRET_KEY: store?.secretKey ?? '',
    },
  },
  // ...
})
```

## Health Checks

All user-facing strings must be wrapped with `i18n()`:

```typescript
ready: {
  display: i18n('Web Interface'),  // Shown in UI
  fn: () =>
    sdk.healthCheck.checkPortListening(effects, 8080, {
      successMessage: i18n('Service is ready'),
      errorMessage: i18n('Service is not ready'),
    }),
},
```

## Volume Mounts

```typescript
sdk.Mounts.of()
  // Mount entire volume (directory)
  .mountVolume({
    volumeId: 'main',
    subpath: null,
    mountpoint: '/data',
    readonly: false,
  })
  // Mount specific file from volume (requires type: 'file')
  .mountVolume({
    volumeId: 'main',
    subpath: 'config.py',
    mountpoint: '/app/config.py',
    readonly: true,
    type: 'file',  // Required when mounting a single file
  })
```

## Writing to Subcontainer Rootfs

For config files that are regenerated on every startup, write directly to the subcontainer's rootfs instead of using volume mounts. This is simpler and avoids file mount issues:

```typescript
// Create subcontainer first (lazy; await .rootfs when you need the path)
const appSub = sdk.SubContainer.of(
  effects,
  { imageId: 'my-service' },
  sdk.Mounts.of().mountVolume({
    volumeId: 'main',
    subpath: null,
    mountpoint: '/data',
    readonly: false,
  }),
  'my-service-sub',
)

// Write config directly to subcontainer rootfs
await writeFile(
  `${await appSub.rootfs}/app/config.py`,
  generateConfig({ secretKey, allowedHosts }),
)
```

**When to use rootfs vs volume mounts:**
- **Rootfs**: Ephemeral config files regenerated on each startup (secrets, hostnames, etc.)
- **Volume mount (directory)**: Persistent data that survives restarts (databases, user files)
- **Volume mount (file)**: Persistent config that users might edit (requires `type: 'file'`)

## PostgreSQL Sidecar

Run a database as a second daemon from the official `postgres` image: bind it to loopback, generate its password on install into `store.json`, health-check with `pg_isready`, and back it up with `sdk.Backups.withPgDump()` (see [File Models](./file-models.md) and [Initialization](./init.md)). The [CRM package](https://github.com/bitcoinRph/crm-startos/blob/release/deploy/startos/startos/main.ts) and [spliit-startos](https://github.com/Start9Labs/spliit-startos) are worked examples.

```typescript
.addDaemon('postgres', {
  subcontainer: postgresSub,
  exec: {
    command: sdk.useEntrypoint(['-c', 'listen_addresses=127.0.0.1']),
    env: { POSTGRES_PASSWORD: pgPassword, POSTGRES_DB: 'app' },
  },
  ready: {
    display: null,
    fn: async () => {
      const { exitCode } = await postgresSub.exec(['pg_isready', '-q', '-h', '127.0.0.1', '-U', 'postgres'])
      return exitCode === 0
        ? { result: 'success', message: i18n('PostgreSQL is ready') }
        : { result: 'loading', message: i18n('Waiting for PostgreSQL') }
    },
  },
  requires: [],
})
```

Daemons share one network namespace, so the app reaches it at `127.0.0.1:5432`. Give `exec` a `cwd` when a command must run from a particular directory, and `runAsInit: true` when an image bundles its own init system (`s6-overlay`, `tini`).

## Executing Commands in SubContainers

Use `exec` or `execFail` to run commands in a subcontainer:

| Method | Behavior on Non-zero Exit |
|--------|---------------------------|
| `exec()` | Returns result with `exitCode`, `stdout`, `stderr` - does NOT throw |
| `execFail()` | Throws an error on non-zero exit code |

```typescript
// exec() - manual error handling (good for optional/warning cases)
const result = await appSub.exec(['update-ca-certificates'], { user: 'root' })
if (result.exitCode !== 0) {
  console.warn('Failed to update CA certificates:', result.stderr)
}

// execFail() - throws on error (good for required commands)
// Uses the default user from the Dockerfile (no need to specify { user: '...' })
await appSub.execFail(['git', 'clone', 'https://github.com/user/repo.git'])

// Override user when needed (e.g., run as root)
await appSub.exec(['update-ca-certificates'], { user: 'root' })
```

**User option**: The `user` option is optional. If omitted, commands run as the default user defined in the Dockerfile (`USER` directive). Only specify `{ user: 'root' }` when you need elevated privileges.

**Use `execFail()` when:**
- The command must succeed for the service to work correctly
- You're in `init/index.ts` and want installation to fail if setup fails
- You want automatic error propagation

**Use `exec()` when:**
- The command failure is not critical (warnings, optional setup)
- You need to inspect the exit code or output regardless of success/failure
- You want custom error handling logic

## Config File Generation

```typescript
function generateConfig(config: { secretKey: string; allowedHosts: string[] }): string {
  const hostsList = config.allowedHosts.map((h) => `'${h}'`).join(', ')

  return `
SECRET_KEY = '${config.secretKey}'
ALLOWED_HOSTS = [${hostsList}]
DATABASE = '/data/db.sqlite3'
`
}
```
