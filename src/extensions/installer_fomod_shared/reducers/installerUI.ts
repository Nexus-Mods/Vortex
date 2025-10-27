import { IReducerSpec } from '../../../types/IExtensionContext';
import { deleteOrNop, setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/installerUI';

export const installerUIReducer: IReducerSpec = {
  reducers: {
    [actions.startDialog as any]: (state, payload) => {
      const { instanceId, info } = payload;
      const newState = setSafe(state, ['activeInstanceId'], instanceId);
      return setSafe(newState, ['instances', instanceId, 'info'], info);
    },
    [actions.endDialog as any]: (state, payload) => {
      const { instanceId } = payload;
      const newState = setSafe(state, ['activeInstanceId'], null);
      return deleteOrNop(newState, ['instances', instanceId]);
    },
    [actions.clearDialog as any]: (state, payload) => {
      const { instanceId } = payload;
      return deleteOrNop(state, ['instances', instanceId, 'state']);
    },
    [actions.setDialogState as any]: (state, payload) => {
      const { instanceId, dialogState } = payload;
      return setSafe(state, ['instances', instanceId, 'state'], dialogState);
    },
    [actions.setInstallerDataPath as any]: (state, payload) => {
      const { instanceId, path } = payload;
      return setSafe(state, ['instances', instanceId, 'dataPath'], path);
    }
  },
  defaults: {
    activeInstanceId: null,
    instances: {},
  },
};
