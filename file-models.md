# File Models

File Models represent configuration files as TypeScript definitions using **zod** schemas (SDK 2.x; the older `matches` API is gone), providing type safety and runtime validation throughout your codebase. Import `z` from `@start9labs/start-sdk`: its `z.object` preserves unknown keys, which keeps upstream-written settings intact. Official reference: `start-technologies/projects/start-sdk/docs/src/file-models.md`.

## Supported Formats

File Models support automatic parsing/serialization for:
- `.json`
- `.yaml` / `.yml`
- `.toml`
- `.ini`
- `.env`

Custom parser/serializer support is available for non-standard formats.

## Creating a File Model

### store.json.ts (Common Pattern)

```typescript
import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

const shape = z.object({
  adminPassword: z.string().optional().catch(undefined),
  secretKey: z.string().catch(''),
  someNumber: z.number().catch(0),
  someFlag: z.boolean().catch(false),
})

export const storeJson = FileHelper.json(
  { base: sdk.volumes.main, subpath: './store.json' },
  shape,
)
```

Give every key a `.catch()` default. Then `storeJson.merge(effects, {})` seeds the file on install, repairs invalid values, and `merge` never removes keys you do not name.

### YAML Configuration

```typescript
import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

const serverShape = z.object({
  host: z.string().catch('localhost'),
  port: z.number().catch(8080),
})

const shape = z.object({
  server: serverShape.catch(() => serverShape.parse({})),
  features: z.array(z.string()).catch([]),
})

export const configYaml = FileHelper.yaml(
  { base: sdk.volumes.main, subpath: 'config.yaml' },
  shape,
)
```

`.catch()` does not cascade into nested objects: give each nested schema its own `.catch(() => nested.parse({}))`.

## Reading File Models

### Reading Methods

| Method | Purpose |
|--------|---------|
| `.once()` | Read content once, no reactivity |
| `.const(effects)` | Read content AND re-run context if changes occur |
| `.onChange(effects)` | Register callback for value changes |
| `.watch(effects)` | Create async iterator of new values |

**Important**: All read methods return `null` if the file doesn't exist. Do NOT use try-catch for missing files.

### Examples

```typescript
// One-time read (no restart on change) - returns null if file doesn't exist
const store = await storeJson.read().once()

// Handle missing file with nullish coalescing
const keys = (await authorizedKeysFile.read().once()) ?? []

// Reactive read (service restarts if value changes)
const store = await storeJson.read().const(effects)

// Read only specific fields (subset reading)
const password = await storeJson.read((s) => s.adminPassword).once()

// Reactive subset read
const secretKey = await storeJson.read((s) => s.secretKey).const(effects)
```

### Subset Reading

Use mapping to retrieve only specific fields rather than entire files:

```typescript
// Read only adminPassword - more efficient
const password = await storeJson.read((s) => s.adminPassword).once()

// Read nested values
const serverHost = await configYaml.read((c) => c.server.host).once()
```

## Writing File Models

### Merge (the default)

```typescript
// Seed on first install: every .catch() default fills in
await storeJson.merge(effects, {})

// Update specific fields, preserve everything else
await storeJson.merge(effects, { someFlag: false })
```

Arrays are replaced whole, objects are merged key by key, and comments in a YAML or TOML file do not survive re-serialization.

### Full Write

Only when the whole file must be replaced, for example in a migration:

```typescript
await storeJson.write(effects, {
  adminPassword: 'secret123',
  secretKey: 'abc123',
  someNumber: 42,
  someFlag: true,
})
```

## Self-healing values

A key that fails validation is replaced by its `.catch()` default on the next `merge`, which is how a hand-edited or corrupted file recovers. Coerce with zod when a stored string should be a number: `z.coerce.number().catch(8080)`.

## Common Patterns

### Optional Fields with Defaults

```typescript
const shape = z.object({
  // Optional, absent by default
  apiKey: z.string().optional().catch(undefined),

  // Optional with a value default
  port: z.number().catch(8080),

  // Generated at install, so the default is the empty string until seeded
  secretKey: z.string().catch(''),
})
```

### Nested Objects

```typescript
const databaseShape = z.object({
  host: z.string().catch('127.0.0.1'),
  port: z.number().catch(5432),
  name: z.string().catch('app'),
})

const shape = z.object({
  database: databaseShape.catch(() => databaseShape.parse({})),
})
```

### Hardcoded Literal Values

For values that should always be a specific literal and never change (e.g., internal ports, paths, auth modes), use `z.literal().catch()`:

```typescript
import { FileHelper, z } from '@start9labs/start-sdk'

const port = 8080
const dataDir = '/data'

const shape = z.object({
  // These values are hardcoded and will be corrected on the next merge
  port: z.literal(port).catch(port),
  dataDir: z.literal(dataDir).catch(dataDir),
  auth: z.literal('password').catch('password'),
  tls: z.literal(false).catch(false),

  // This value can vary
  password: z.string().optional().catch(undefined),
})
```

This pattern ensures:
- The value is validated to match the literal exactly
- If the file ends up with a different value (e.g., user edits it manually), it's corrected on the next `merge()`
- You can use `merge()` to update only the non-literal fields without specifying the hardcoded ones

### Using SDK Input Spec Validators

For complex types like SMTP, use the SDK's built-in validators:

```typescript
import { FileHelper, smtpShape, z } from '@start9labs/start-sdk'

const shape = z.object({
  adminPassword: z.string().optional().catch(undefined),
  smtp: smtpShape,
})
```
