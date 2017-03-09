import { IReducerSpec } from '../../../types/IExtensionContext';
import { deleteOrNop, setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/installerUI';

export const installerUIReducer: IReducerSpec = {
  reducers: {
    [actions.startDialog as any]: (state, payload) => {
      return setSafe(state, ['info'], payload);
    },
    [actions.endDialog as any]: (state, payload) => {
      return deleteOrNop(state, ['info']);
    },
    [actions.setDialogState as any]: (state, payload) => {
      return setSafe(state, ['state'], payload);
    },
    [actions.setInstallerDataPath as any]: (state, payload) => {
      return setSafe(state, ['dataPath'], payload);
    },
  }, defaults: {
    dataPath: undefined,
    info: undefined,
    state: undefined,
  },
};
