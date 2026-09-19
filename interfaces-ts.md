# interfaces.ts Patterns

## Single Interface

See `hello-world-startos/startos/interfaces.ts` for the basic pattern.

## Multiple Interfaces

Expose multiple paths (e.g., web UI and admin panel):

```typescript
import { i18n } from './i18n'
import { sdk } from './sdk'

const uiPort = 8080

export const setInterfaces = sdk.setupInterfaces(async ({ effects }) => {
  const uiMulti = sdk.MultiHost.of(effects, 'ui-multi')
  const uiMultiOrigin = await uiMulti.bindPort(uiPort, {
    protocol: 'http',
  })

  const ui = sdk.createInterface(effects, {
    name: i18n('Web UI'),
    id: 'ui',
    description: i18n('The web interface'),
    type: 'ui',
    masked: false,
    schemeOverride: null,
    username: null,
    path: '',
    query: {},
  })

  const admin = sdk.createInterface(effects, {
    name: i18n('Admin Panel'),
    id: 'admin',
    description: i18n('Admin interface'),
    type: 'ui',
    masked: false,
    schemeOverride: null,
    username: null,
    path: '/admin/',
    query: {},
  })

  const uiReceipt = await uiMultiOrigin.export([ui, admin])
  return [uiReceipt]
})
```

## Reading Your Own Addresses

`sdk.host.getOwn(effects, 'ui-multi')` (the id given to `sdk.MultiHost.of`) returns the host; the exported interface is `host.bindings[uiPort].interfaces['ui']` and its `addressInfo` formats URLs and hostnames. See [main.ts](./main-ts.md#getting-hostnames). The user decides where an interface is reachable (LAN, a domain, Tor) on the service's Interfaces tab; the package only declares what it serves. Never claim in docs that a service "is exposed on Tor" or "the internet".

## Interface Options

```typescript
sdk.createInterface(effects, {
  name: i18n('Display Name'),     // Shown in UI (wrap with i18n)
  id: 'unique-id',                // Used in sdk.host.getOwn()
  description: i18n('Description'), // Shown in UI (wrap with i18n)
  type: 'ui',                     // 'ui', 'api' or 'p2p' (a label for the user, not a control)
  masked: false,                  // Show the URL as a copyable secret?
  schemeOverride: null,           // Force 'https' or 'http'?
  username: null,                 // Auth username (if any)
  path: '/some/path/',            // URL path
  query: {},                      // URL query params
})
```
