import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/mods';

/**
 * reducer for changes to the mods highlights
 */
export const modsReducer: IReducerSpec = {
  reducers: {
    [actions.setModColor]: (state, payload) => {
      const { gameId, modId, modColor } = payload;
      return setSafe(state, [gameId, modId, 'modColor'], modColor);
    },
    [actions.setModIcon]: (state, payload) => {
      const { gameId, modId, modIcon } = payload;
      return setSafe(state, [gameId, modId, 'modIcon'], modIcon);
    },
    [actions.setModNotes]: (state, payload) => {
      const { gameId, modId, modNotes } = payload;
      return setSafe(state, [gameId, modId, 'modNotes'], modNotes);
    },
  }, defaults: {
  },
};
