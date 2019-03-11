import { IReducerSpec } from '../../../types/IExtensionContext';
import { deleteOrNop, setSafe } from '../../../util/storeHelper';
import * as actions from '../actions/transactions';

export const transactionsReducer: IReducerSpec = {
  reducers: {
    [actions.setTransferDownloads as any]: (state, payload) => {
      const { destination } = payload;
      return ((destination === undefined) || (destination === ''))
        ? deleteOrNop(state, ['transfer', 'downloads'])
        : setSafe(state, ['transfer', 'downloads'], destination);
    },
  },
  defaults: {
  },
};
