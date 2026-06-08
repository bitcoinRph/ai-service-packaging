export const DEFAULT_LANG = 'en_US'

const dict = {
  // main.ts
  'Web Interface': 0,
  'The web interface is ready': 1,
  'The web interface is not ready': 2,

  // interfaces.ts
  'Web UI': 3,
  'The Codex Autorunner hub control plane': 4,

  // actions/getLoginLink.ts
  'Get Login Link': 5,
  'Retrieve the one-time bootstrap login link for the web UI': 6,
  'No active bootstrap token was found. It is consumed on first login and rotated on each restart. Restart Codex Autorunner to generate a fresh login link.': 7,
  'Login Link Unavailable': 8,
  'Open this URL to log in': 9,
  'Bootstrap Login Link': 10,
  'Open one of these one-time login URLs in your browser. The token is single-use and expires in 24 hours; restart the service to issue a new one.': 11,
  'Bootstrap Token': 12,
  'Append to your address as /auth/bootstrap#token=<token>': 13,

  // init/initializeService.ts
  'Retrieve your one-time login link for the web UI': 14,
} as const

/**
 * Plumbing. DO NOT EDIT.
 */
export type I18nKey = keyof typeof dict
export type LangDict = Record<(typeof dict)[I18nKey], string>
export default dict
