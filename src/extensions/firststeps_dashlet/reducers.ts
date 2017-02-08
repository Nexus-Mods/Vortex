import { IReducerSpec } from '../../types/IExtensionContext';
import {deleteOrNop, setSafe} from '../../util/storeHelper';

import * as actions from './actions';

/**
 * reducer for changes to interface settings
 */
const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.dismissStep]:
    (state, payload) => setSafe(state, ['steps', payload], true),
  },
  defaults: {
    dismissAll: false,
    steps: {},
  },
};

export default settingsReducer;

