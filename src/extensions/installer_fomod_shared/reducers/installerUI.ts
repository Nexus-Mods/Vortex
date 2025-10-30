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
      const newState2 = setSafe(newState, ['instances', instanceId, 'info'], null);
      return deleteOrNop(newState2, ['instances', instanceId, 'dataPath']);
    },
    [actions.clearDialog as any]: (state, payload) => {
      const { instanceId } = payload;
      return deleteOrNop(state, ['instances', instanceId]);
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
