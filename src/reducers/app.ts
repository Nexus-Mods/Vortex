import * as actions from '../actions/app';
import {IReducerSpec} from '../types/IExtensionContext';
import {setSafe} from '../util/storeHelper';

import {app} from 'electron';

/**
 * reducer for changes to the window state
 */
export const appReducer: IReducerSpec = {
  reducers: {
    [actions.setStateVersion as any]: (state, payload) => setSafe(state, ['version'], payload),
  },
  defaults: {
    version: '',
  },
};
