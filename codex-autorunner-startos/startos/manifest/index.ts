import { setupManifest } from '@start9labs/start-sdk'
import { long, short, alertInstall } from './i18n'

export const manifest = setupManifest({
  id: 'codex-autorunner',
  title: 'Codex Autorunner',
  license: 'MIT',
  packageRepo: 'https://github.com/bitcoinRph/ai-service-packaging',
  upstreamRepo: 'https://github.com/Git-on-my-level/codex-autorunner',
  marketingUrl: 'https://github.com/Git-on-my-level/codex-autorunner',
  donationUrl: null,
  description: { short, long },
  volumes: ['main'],
  images: {
    'codex-autorunner': {
      source: { dockerBuild: {} },
      arch: ['x86_64', 'aarch64'],
    },
  },
  alerts: {
    install: alertInstall,
    update: null,
    uninstall: null,
    restore: null,
    start: null,
    stop: null,
  },
  dependencies: {},
})
