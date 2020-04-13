import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/loadOrder';

export const modLoadOrderReducer: IReducerSpec = {
  reducers: {
    [actions.setLoadOrderEntry as any]: (state, payload) => {
      const { profileId, modId, loEntry } = payload;
      return setSafe(state, [profileId, modId], loEntry);
    },
  },
  defaults: {},
};
