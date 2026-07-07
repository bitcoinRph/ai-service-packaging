import { sdk } from '../sdk'
import { getApiCredentials } from './getApiCredentials'
import { selectModel } from './selectModel'
import { configureLlmCleanup } from './configureLlmCleanup'

export const actions = sdk.Actions.of()
  .addAction(getApiCredentials)
  .addAction(selectModel)
  .addAction(configureLlmCleanup)
