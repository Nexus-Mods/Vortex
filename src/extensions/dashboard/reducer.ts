import { IReducerSpec } from '../../types/IExtensionContext';
import {setSafe} from '../../util/storeHelper';

import * as actions from './actions';

/**
 * reducer for changes to interface settings
 */
const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.setLayout as any]:
      (state, payload) => setSafe(state, ['dashboardLayout'], payload),
    [actions.setDashletEnabled as any]: (state, payload) =>
      setSafe(state, ['dashletSettings', payload.widgetId, 'enabled'], payload.enabled),
    [actions.setDashletWidth as any]: (state, payload) =>
      setSafe(state, ['dashletSettings', payload.widgetId, 'width'], payload.width),
    [actions.setDashletHeight as any]: (state, payload) =>
      setSafe(state, ['dashletSettings', payload.widgetId, 'height'], payload.height),
  },
  defaults: {
    dashboardLayout: [],
    dashletSettings: {},
  },
};

export default settingsReducer;
