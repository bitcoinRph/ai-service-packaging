import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { storeJson } from '../fileModels/store.json'

const { InputSpec, Value } = sdk

export const inputSpec = InputSpec.of({
  llmBaseUrl: Value.text({
    name: i18n('LLM Base URL'),
    description: i18n(
      'OpenAI-compatible endpoint of your local LLM, e.g. your Ollama service: http://<ollama-host>:11434/v1. Leave empty to disable cleanup.',
    ),
    default: null,
    required: false,
    placeholder: 'http://ollama.embassy:11434/v1',
  }),
  llmModel: Value.text({
    name: i18n('LLM Model'),
    description: i18n(
      'Model name to use for cleanup, e.g. llama3.2 or qwen2.5. Must already be pulled in Ollama.',
    ),
    default: null,
    required: false,
    placeholder: 'llama3.2',
  }),
})

export const configureLlmCleanup = sdk.Action.withInput(
  'configure-llm-cleanup',

  async ({ effects }) => ({
    name: i18n('Configure AI Cleanup (optional)'),
    description: i18n(
      'Route dictation cleanup through a local LLM such as Ollama. When set, the Diction keyboard can polish transcripts without any cloud service.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,

  // Pre-fill with current values
  async ({ effects }) => {
    const store = await storeJson.read((s) => s).once()
    return {
      llmBaseUrl: store?.llmBaseUrl ?? null,
      llmModel: store?.llmModel ?? null,
    }
  },

  // Save to store — the reactive read in main.ts restarts the service
  async ({ effects, input }) => {
    await storeJson.merge(effects, {
      llmBaseUrl: input.llmBaseUrl || undefined,
      llmModel: input.llmModel || undefined,
    })
  },
)
