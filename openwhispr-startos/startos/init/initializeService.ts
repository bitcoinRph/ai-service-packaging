import { utils } from '@start9labs/start-sdk'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { storeJson } from '../fileModels/store.json'
import { getApiCredentials } from '../actions/getApiCredentials'

export const initializeService = sdk.setupOnInit(async (effects, kind) => {
  if (kind === null) return // container rebuild — nothing to do

  if (kind === 'install') {
    const token = utils.getDefaultString({
      charset: 'a-z,A-Z,0-9',
      len: 32,
    })
    await storeJson.write(effects, { token, model: 'small' })
  }

  // Runs on both install and restore
  await sdk.action.createOwnTask(effects, getApiCredentials, 'critical', {
    reason: i18n(
      'Retrieve your API token to use the web recorder, iOS Shortcuts, and API clients',
    ),
  })
})
