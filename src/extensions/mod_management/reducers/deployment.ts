import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';
import * as actions from '../actions/deployment';

export const deploymentReducer: IReducerSpec = {
  reducers: {
    [actions.setDeploymentNecessary as any]: (state, payload) =>
      setSafe(state, ['needToDeploy', payload.gameId], payload.required),
  },
  defaults: {
    needToDeploy: {},
  },
};
