export const DEFAULT_LANG = 'en_US'

const dict = {
  // main.ts
  'Starting OpenWhispr STT Server': 0,
  'Speech-to-Text Engine': 1,
  'The transcription server is listening. On first start, transcription begins once the Whisper model finishes downloading.': 2,
  'The transcription server is not ready': 3,
  'Keyboard Gateway': 4,
  'The Diction keyboard gateway is ready': 5,
  'The Diction keyboard gateway is not ready': 6,

  // interfaces.ts
  'Web Recorder': 7,
  'Mobile-friendly recorder — open in Safari, record, and copy your transcript. Also serves the OpenAI-compatible transcription API.': 8,
  'Keyboard API': 9,
  'Enter this address in the Diction iOS keyboard app (Preferences → Mode → Self-Hosted) to dictate with your own server.': 10,

  // actions/getApiCredentials.ts
  'Get API Credentials': 11,
  'Retrieve the token used by the web recorder, iOS Shortcuts, and OpenAI-compatible clients': 12,
  'API Credentials': 13,
  'Paste this token into the web recorder settings, or send it as an "Authorization: Bearer" header to the transcription API. The Diction keyboard gateway holds it internally — the Diction app itself does not need it.': 14,
  'API Token': 15,

  // actions/selectModel.ts
  'Whisper Model': 16,
  'Larger models are more accurate but slower and use more memory. All models run 100% locally on your server.': 17,
  'Switching models downloads the new model on next start (75 MB – 1.6 GB). Transcription is unavailable until the download completes.': 18,
  'Select Whisper Model': 19,
  'Choose which local Whisper model to use for transcription': 20,

  // actions/configureLlmCleanup.ts
  'LLM Base URL': 21,
  'OpenAI-compatible endpoint of your local LLM, e.g. your Ollama service: http://<ollama-host>:11434/v1. Leave empty to disable cleanup.': 22,
  'LLM Model': 23,
  'Model name to use for cleanup, e.g. llama3.2 or qwen2.5. Must already be pulled in Ollama.': 24,
  'Configure AI Cleanup (optional)': 25,
  'Route dictation cleanup through a local LLM such as Ollama. When set, the Diction keyboard can polish transcripts without any cloud service.': 26,

  // init/initializeService.ts
  'Retrieve your API token to use the web recorder, iOS Shortcuts, and API clients': 27,
} as const

/**
 * Plumbing. DO NOT EDIT.
 */
export type I18nKey = keyof typeof dict
export type LangDict = Record<(typeof dict)[I18nKey], string>
export default dict
