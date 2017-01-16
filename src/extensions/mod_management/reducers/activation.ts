import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/activation';

export const activationReducer: IReducerSpec = {
  reducers: {
    [actions.storeActivation]: (state, payload) => {
      return setSafe(state, [payload.gameId, payload.activationId], payload.snapshot);
    },
  }, defaults: {
  },
};
