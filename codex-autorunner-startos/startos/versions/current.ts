import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '2.1.2:0',
  releaseNotes: {
    en_US: 'Initial StartOS packaging of Codex Autorunner.',
    es_ES: 'Empaquetado inicial de Codex Autorunner para StartOS.',
    de_DE: 'Erstes StartOS-Paket von Codex Autorunner.',
    pl_PL: 'Pierwsze spakowanie Codex Autorunner dla StartOS.',
    fr_FR: 'Premier empaquetage de Codex Autorunner pour StartOS.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
