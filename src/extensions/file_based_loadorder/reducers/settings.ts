import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/settings';

export const loadOrderSettingsReducer: IReducerSpec = {
  reducers: {
    [actions.setGameLoadOrderDisplayCheckboxes as any]: (state, payload) => {
      const { gameId, displayCheckboxes } = payload;
      return setSafe(state,
        ['rendererOptions', gameId, 'displayCheckboxes'], displayCheckboxes);
    },
  },
  defaults: {},
};
