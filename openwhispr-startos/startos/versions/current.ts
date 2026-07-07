import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.1.0:0',
  releaseNotes: {
    en_US: 'Initial release.',
    es_ES: 'Versión inicial.',
    de_DE: 'Erste Veröffentlichung.',
    pl_PL: 'Wydanie początkowe.',
    fr_FR: 'Version initiale.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
