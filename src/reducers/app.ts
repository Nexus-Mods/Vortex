import * as actions from '../actions/app';
import {IReducerSpec} from '../types/IExtensionContext';
import {deleteOrNop, setSafe} from '../util/storeHelper';

import {app} from 'electron';

/**
 * reducer for changes to the window state
 */
export const appReducer: IReducerSpec = {
  reducers: {
    [actions.setStateVersion as any]: (state, payload) => setSafe(state, ['version'], payload),
    [actions.setExtensionEnabled as any]: (state, payload) =>
      setSafe(state, ['extensions', payload.extensionId, 'enabled'], payload.enabled),
    [actions.removeExtension as any]: (state, payload) =>
      setSafe(state, ['extensions', payload, 'remove'], true),
    [actions.forgetExtension as any]: (state, payload) =>
      deleteOrNop(state, ['extensions', payload]),
  },
  defaults: {
    version: '',
    extensions: {},
  },
};
