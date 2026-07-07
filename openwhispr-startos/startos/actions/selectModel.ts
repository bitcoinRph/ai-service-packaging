import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { storeJson } from '../fileModels/store.json'
import { whisperModels, WhisperModel } from '../utils'

const { InputSpec, Value } = sdk

export const inputSpec = InputSpec.of({
  model: Value.select({
    name: i18n('Whisper Model'),
    description: i18n(
      'Larger models are more accurate but slower and use more memory. All models run 100% locally on your server.',
    ),
    warning: i18n(
      'Switching models downloads the new model on next start (75 MB – 1.6 GB). Transcription is unavailable until the download completes.',
    ),
    default: 'small',
    values: {
      tiny: 'tiny (75 MB — fastest, lowest accuracy)',
      base: 'base (142 MB — fast, decent accuracy)',
      small: 'small (466 MB — recommended balance)',
      medium: 'medium (1.5 GB — high accuracy, slower)',
      'large-v3-turbo': 'large-v3-turbo (1.6 GB — best accuracy, fast)',
    },
  }),
})

export const selectModel = sdk.Action.withInput(
  'select-model',

  async ({ effects }) => ({
    name: i18n('Select Whisper Model'),
    description: i18n(
      'Choose which local Whisper model to use for transcription',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,

  // Pre-fill with the current model
  async ({ effects }) => {
    const model = await storeJson.read((s) => s.model).once()
    return {
      model: whisperModels.includes(model as WhisperModel)
        ? (model as WhisperModel)
        : ('small' as const),
    }
  },

  // Save to store — the reactive read in main.ts restarts the service
  async ({ effects, input }) => {
    await storeJson.merge(effects, { model: input.model })
  },
)
