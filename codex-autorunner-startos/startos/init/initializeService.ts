import { sdk } from '../sdk'
import { i18n } from '../i18n'
import { getLoginLink } from '../actions/getLoginLink'

export const initializeService = sdk.setupOnInit(async (effects, kind) => {
  if (kind === null) return

  // CAR has no built-in password; first login uses a one-time bootstrap link.
  // Prompt the user to retrieve it once the hub is running.
  await sdk.action.createOwnTask(effects, getLoginLink, 'critical', {
    reason: i18n('Retrieve your one-time login link for the web UI'),
  })
})
