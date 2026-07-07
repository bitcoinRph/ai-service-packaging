import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

const shape = z.object({
  token: z.string().optional().catch(undefined),
  model: z.string().optional().catch('small'),
  llmBaseUrl: z.string().optional().catch(undefined),
  llmModel: z.string().optional().catch(undefined),
})

export const storeJson = FileHelper.json(
  { base: sdk.volumes.main, subpath: 'store.json' },
  shape,
)
