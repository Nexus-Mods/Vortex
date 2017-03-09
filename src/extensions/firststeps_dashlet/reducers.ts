import { IReducerSpec } from '../../types/IExtensionContext';
import {setSafe} from '../../util/storeHelper';

import * as actions from './actions';

/**
 * reducer for changes to interface settings
 */
const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.dismissStep as any]:
    (state, payload) => setSafe(state, ['steps', payload], true),
  },
  defaults: {
    dismissAll: false,
    steps: {},
  },
};

export default settingsReducer;
