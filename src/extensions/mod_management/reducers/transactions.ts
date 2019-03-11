import { IReducerSpec } from '../../../types/IExtensionContext';
import { deleteOrNop, setSafe } from '../../../util/storeHelper';
import * as actions from '../actions/transactions';

export const transactionsReducer: IReducerSpec = {
  reducers: {
    [actions.setTransferMods as any]: (state, payload) => {
      const { gameId, destination } = payload;
      return ((destination === undefined) || (destination === ''))
        ? deleteOrNop(state, ['transfer', gameId])
        : setSafe(state, ['transfer', gameId], destination);
    },
  },
  defaults: {
  },
};
