import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { bootstrapTokenSubpath } from '../utils'

/**
 * CAR's web UI has no username/password. First browser login uses a one-time
 * bootstrap token: open `https://<host>/auth/bootstrap#token=<token>` and CAR
 * sets a session cookie. This action surfaces the current token (rewritten by
 * CAR on each boot, valid 24h, consumed on first successful login) and the
 * ready-to-use login URLs for each of the service's addresses.
 */
export const getLoginLink = sdk.Action.withoutInput(
  'get-login-link',

  async ({ effects }) => ({
    name: i18n('Get Login Link'),
    description: i18n(
      'Retrieve the one-time bootstrap login link for the web UI',
    ),
    warning: null,
    allowedStatuses: 'only-running',
    group: null,
    visibility: 'enabled',
  }),

  async ({ effects }) => {
    const token = await sdk.volumes.main
      .readFile(bootstrapTokenSubpath)
      .then((buf) => buf.toString().trim())
      .catch(() => '')

    const hostnames =
      (await sdk.serviceInterface
        .getOwn(effects, 'ui', (i) =>
          i?.addressInfo?.format('hostname-info').map((h) => h.hostname),
        )
        .once()) || []

    if (!token) {
      return {
        version: '1' as const,
        title: i18n('Login Link Unavailable'),
        message: i18n(
          'No active bootstrap token was found. It is consumed on first login and rotated on each restart. Restart Codex Autorunner to generate a fresh login link.',
        ),
        result: null,
      }
    }

    const links = hostnames.map((host, index) => ({
      type: 'single' as const,
      name: host,
      description: index === 0 ? i18n('Open this URL to log in') : null,
      value: `https://${host}/auth/bootstrap#token=${token}`,
      masked: true,
      copyable: true,
      qr: true,
    }))

    return {
      version: '1' as const,
      title: i18n('Bootstrap Login Link'),
      message: i18n(
        'Open one of these one-time login URLs in your browser. The token is single-use and expires in 24 hours; restart the service to issue a new one.',
      ),
      result: {
        type: 'group' as const,
        value:
          links.length > 0
            ? links
            : [
                {
                  type: 'single' as const,
                  name: i18n('Bootstrap Token'),
                  description: i18n(
                    'Append to your address as /auth/bootstrap#token=<token>',
                  ),
                  value: token,
                  masked: true,
                  copyable: true,
                  qr: false,
                },
              ],
      },
    }
  },
)
