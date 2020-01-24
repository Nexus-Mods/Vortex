import * as actions from '../actions/notificationSettings';
import {IReducerSpec} from '../types/IExtensionContext';
import {setSafe} from '../util/storeHelper';

export const notificationSettingsReducer: IReducerSpec = {
  reducers: {
    [actions.suppressNotification as any]: (state, payload) =>
      setSafe(state, ['suppress', payload.id], payload.suppress),
    [actions.resetSuppression as any]: (state) =>
      setSafe(state, ['suppress'], {}),
  },
  defaults: {
    suppress: {},
  },
};
