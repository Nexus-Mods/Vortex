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
  },
  defaults: {
    dashboardLayout: ['Starter'],
  },
};

export default settingsReducer;
