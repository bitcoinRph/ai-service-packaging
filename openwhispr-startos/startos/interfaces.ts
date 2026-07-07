import { i18n } from './i18n'
import { sdk } from './sdk'
import { gatewayPort, webPort } from './utils'

export const setInterfaces = sdk.setupInterfaces(async ({ effects }) => {
  const uiMulti = sdk.MultiHost.of(effects, 'ui-multi')
  const uiMultiOrigin = await uiMulti.bindPort(webPort, {
    protocol: 'http',
  })
  const ui = sdk.createInterface(effects, {
    name: i18n('Web Recorder'),
    id: 'ui',
    description: i18n(
      'Mobile-friendly recorder — open in Safari, record, and copy your transcript. Also serves the OpenAI-compatible transcription API.',
    ),
    type: 'ui',
    masked: false,
    schemeOverride: null,
    username: null,
    path: '',
    query: {},
  })
  const uiReceipt = await uiMultiOrigin.export([ui])

  const apiMulti = sdk.MultiHost.of(effects, 'api-multi')
  const apiMultiOrigin = await apiMulti.bindPort(gatewayPort, {
    protocol: 'http',
  })
  const api = sdk.createInterface(effects, {
    name: i18n('Keyboard API'),
    id: 'api',
    description: i18n(
      'Enter this address in the Diction iOS keyboard app (Preferences → Mode → Self-Hosted) to dictate with your own server.',
    ),
    type: 'api',
    masked: false,
    schemeOverride: null,
    username: null,
    path: '',
    query: {},
  })
  const apiReceipt = await apiMultiOrigin.export([api])

  return [uiReceipt, apiReceipt]
})
