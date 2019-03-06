import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe, deleteOrNop } from '../../../util/storeHelper';
import * as actions from '../actions/transfer';

export const transferReducer: IReducerSpec = {
  reducers: {
    [actions.setTransferMods as any]: (state, payload) => {
      const { gameId, destination } = payload;
      return ((destination === undefined) || (destination === ''))
        ? deleteOrNop(state, ['mods', gameId])
        : setSafe(state, ['mods', gameId], destination);
    }
  },
  defaults: {
    mods: {},
  },
};
