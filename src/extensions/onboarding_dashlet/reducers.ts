import { IReducerSpec } from '../../types/IExtensionContext';
import {setSafe} from '../../util/storeHelper';

import * as actions from './actions';

/**
 * reducer for changes to interface settings
 */
const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.completeStep as any]: (state, payload) => setSafe(state, ['steps', payload], true),
    [actions.resetSteps as any]: (state) => setSafe(state, ['steps'], {}),
  },
  defaults: {
    steps: {},
  },
};

export default settingsReducer;
