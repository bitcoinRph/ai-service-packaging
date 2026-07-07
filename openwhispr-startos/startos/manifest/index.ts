import { setupManifest } from '@start9labs/start-sdk'
import { alertInstall, long, short } from './i18n'

export const manifest = setupManifest({
  id: 'openwhispr',
  title: 'OpenWhispr STT Server',
  license: 'MIT',
  packageRepo: 'https://github.com/bitcoinRph/openwhispr-startos',
  upstreamRepo: 'https://github.com/bitcoinRph/openwhispr',
  marketingUrl: 'https://openwhispr.com/',
  donationUrl: null,
  description: { short, long },
  volumes: ['main'],
  images: {
    openwhispr: {
      source: { dockerBuild: { workdir: './server' } },
      arch: ['x86_64'],
    },
    gateway: {
      source: { dockerTag: 'ghcr.io/omachala/diction-gateway:v9.0' },
      arch: ['x86_64'],
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
