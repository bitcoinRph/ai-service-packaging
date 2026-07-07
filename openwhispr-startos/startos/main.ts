import { i18n } from './i18n'
import { sdk } from './sdk'
import { storeJson } from './fileModels/store.json'
import { gatewayPort, webPort } from './utils'

export const main = sdk.setupMain(async ({ effects }) => {
  console.info(i18n('Starting OpenWhispr STT Server'))

  // Reactive read: changing the model or LLM settings restarts the service
  const store = await storeJson.read((s) => s).const(effects)
  const token = store?.token ?? ''
  const model = store?.model ?? 'small'

  const whisperSub = await sdk.SubContainer.of(
    effects,
    { imageId: 'openwhispr' },
    sdk.Mounts.of().mountVolume({
      volumeId: 'main',
      subpath: null,
      mountpoint: '/data',
      readonly: false,
    }),
    'openwhispr-sub',
  )

  const gatewaySub = await sdk.SubContainer.of(
    effects,
    { imageId: 'gateway' },
    sdk.Mounts.of(),
    'gateway-sub',
  )

  const gatewayEnv: Record<string, string> = {
    GATEWAY_PORT: String(gatewayPort),
    // Daemons share the service's network namespace, so the gateway reaches
    // the whisper shim over localhost.
    CUSTOM_BACKEND_URL: `http://localhost:${webPort}`,
    CUSTOM_BACKEND_AUTH: `Bearer ${token}`,
    CUSTOM_BACKEND_NEEDS_WAV: 'true',
    CUSTOM_BACKEND_CANONICAL_ID: `ggml-${model}`,
  }
  if (store?.llmBaseUrl && store?.llmModel) {
    gatewayEnv.LLM_BASE_URL = store.llmBaseUrl
    gatewayEnv.LLM_MODEL = store.llmModel
  }

  return sdk.Daemons.of(effects)
    .addDaemon('whisper', {
      subcontainer: whisperSub,
      exec: {
        command: ['node', '/app/server.js'],
        env: {
          OW_TOKEN: token,
          OW_MODEL: model,
          PORT: String(webPort),
        },
      },
      ready: {
        display: i18n('Speech-to-Text Engine'),
        fn: () =>
          sdk.healthCheck.checkPortListening(effects, webPort, {
            successMessage: i18n(
              'The transcription server is listening. On first start, transcription begins once the Whisper model finishes downloading.',
            ),
            errorMessage: i18n('The transcription server is not ready'),
          }),
      },
      requires: [],
    })
    .addDaemon('gateway', {
      subcontainer: gatewaySub,
      exec: {
        command: sdk.useEntrypoint(),
        env: gatewayEnv,
      },
      ready: {
        display: i18n('Keyboard Gateway'),
        fn: () =>
          sdk.healthCheck.checkPortListening(effects, gatewayPort, {
            successMessage: i18n('The Diction keyboard gateway is ready'),
            errorMessage: i18n('The Diction keyboard gateway is not ready'),
          }),
      },
      requires: ['whisper'],
    })
})
