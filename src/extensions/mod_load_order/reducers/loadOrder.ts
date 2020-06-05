import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/loadOrder';

export const modLoadOrderReducer: IReducerSpec = {
  reducers: {
    [actions.setLoadOrderEntry as any]: (state, payload) => {
      const { profileId, modId, loEntry } = payload;
      return setSafe(state, [profileId, modId], loEntry);
    },
    [actions.setGameLoadOrderOptions as any]: (state, payload) => {
      const { gameId, profileId, itemRendererOptions } = payload;
      return setSafe(state, [gameId, profileId], itemRendererOptions);
    },
  },
  defaults: {
    defaultItemRendererOptions: {
      displayCheckboxes: true,
      listViewType: 'full',
    },
  },
};
