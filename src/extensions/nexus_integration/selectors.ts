import { IState } from '../../types/IState';
import { getSafe } from '../../util/storeHelper';

import { createSelector } from 'reselect';
import { truthy } from '../../util/util';

export const apiKey = (state: IState) =>
  getSafe(state, ['confidential', 'account', 'nexus', 'APIKey'], undefined);

export const isLoggedIn = (state: IState) => {
  const APIKEY = state.confidential.account['nexus']?.APIKey;
  const OAuthCredentials = state.confidential.account['nexus']?.OAuthCredentials;
  return truthy(APIKEY) || truthy(OAuthCredentials);
};
