import * as actions from '../actions/loadOrder';
import {IReducerSpec} from '../types/IExtensionContext';
import {setSafe} from '../util/storeHelper';

export const loReducer: IReducerSpec = {
  reducers: {
    [actions.setLoadOrder as any]: (state, payload) => setSafe(state, [payload.id], payload.order),
  },
  defaults: {
  },
  verifiers: {
  },
};
