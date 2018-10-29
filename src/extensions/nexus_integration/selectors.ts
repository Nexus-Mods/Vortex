import { IState } from '../../types/IState';
import { getSafe } from '../../util/storeHelper';

import { createSelector } from 'reselect';

export const apiKey = (state: IState) =>
  getSafe(state, ['confidential', 'account', 'nexus', 'APIKey'], undefined);
