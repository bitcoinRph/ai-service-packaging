import { i18n } from './i18n'
import { sdk } from './sdk'
import {
  carEnv,
  hubConfigSubpath,
  hubDir,
  renderHubConfig,
  uiPort,
} from './utils'

export const main = sdk.setupMain(async ({ effects }) => {
  /**
   * ======================== Setup ========================
   *
   * CAR enforces an explicit TrustedHost/CORS allow-list when serving on a
   * non-loopback host. Resolve the StartOS interface hostnames (mapper keeps us
   * from restarting on unrelated interface changes) and write them into the
   * config override that CAR reads at highest precedence.
   */
  const hostnames =
    (await sdk.serviceInterface
      .getOwn(effects, 'ui', (i) =>
        i?.addressInfo?.format('hostname-info').map((h) => h.hostname),
      )
      .const()) || []

  await sdk.volumes.main.writeFile(hubConfigSubpath, renderHubConfig(hostnames))

  const appSub = await sdk.SubContainer.of(
    effects,
    { imageId: 'codex-autorunner' },
    sdk.Mounts.of().mountVolume({
      volumeId: 'main',
      subpath: null,
      mountpoint: '/data',
      readonly: false,
    }),
    'codex-autorunner-sub',
  )

  /**
   * ======================== Daemons ========================
   *
   * `car init --mode hub` is idempotent (it only seeds missing files), so it is
   * safe to run on every startup before the hub server comes up.
   */
  return sdk.Daemons.of(effects)
    .addOneshot('init-hub', {
      subcontainer: appSub,
      exec: {
        command: ['car', 'init', '--mode', 'hub', '--path', hubDir],
        env: carEnv,
      },
      requires: [],
    })
    .addDaemon('hub', {
      subcontainer: appSub,
      exec: {
        command: [
          'car',
          'hub',
          'serve',
          '--path',
          hubDir,
          '--host',
          '0.0.0.0',
          '--port',
          `${uiPort}`,
        ],
        env: carEnv,
      },
      ready: {
        display: i18n('Web Interface'),
        fn: () =>
          sdk.healthCheck.checkPortListening(effects, uiPort, {
            successMessage: i18n('The web interface is ready'),
            errorMessage: i18n('The web interface is not ready'),
          }),
      },
      requires: ['init-hub'],
    })
})
