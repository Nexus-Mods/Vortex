import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe, deleteOrNop } from '../../../util/storeHelper';
import * as actions from '../actions/transfer';

export const transferReducer: IReducerSpec = {
  reducers: {
    [actions.setTransferDownloads as any]: (state, payload) => {
      const { destination } = payload;
      return ((destination === undefined) || (destination === ''))
        ? deleteOrNop(state, ['downloads'])
        : setSafe(state, ['downloads'], destination);
    }
  },
  defaults: {
    downloads: undefined,
  },
};
