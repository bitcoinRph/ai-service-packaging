import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { storeJson } from '../fileModels/store.json'

export const getApiCredentials = sdk.Action.withoutInput(
  'get-api-credentials',

  async ({ effects }) => ({
    name: i18n('Get API Credentials'),
    description: i18n(
      'Retrieve the token used by the web recorder, iOS Shortcuts, and OpenAI-compatible clients',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  async ({ effects }) => {
    const store = await storeJson.read((s) => s).once()

    return {
      version: '1' as const,
      title: i18n('API Credentials'),
      message: i18n(
        'Paste this token into the web recorder settings, or send it as an "Authorization: Bearer" header to the transcription API. The Diction keyboard gateway holds it internally — the Diction app itself does not need it.',
      ),
      result: {
        type: 'group',
        value: [
          {
            type: 'single',
            name: i18n('API Token'),
            description: null,
            value: store?.token ?? 'UNKNOWN',
            masked: true,
            copyable: true,
            qr: true,
          },
        ],
      },
    }
  },
)
