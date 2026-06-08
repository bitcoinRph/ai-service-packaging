import { sdk } from '../sdk'
import { getLoginLink } from './getLoginLink'

export const actions = sdk.Actions.of().addAction(getLoginLink)
