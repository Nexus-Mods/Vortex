import * as actions from '../actions/app';
import {IReducerSpec} from '../types/IExtensionContext';
import {deleteOrNop, setSafe} from '../util/storeHelper';

import {app} from 'electron';

export const appReducer: IReducerSpec = {
  reducers: {
    [actions.setStateVersion as any]: (state, payload) => setSafe(state, ['version'], payload),
    [actions.setApplicationVersion as any]:
      (state, payload) => setSafe(state, ['appVersion'], payload),
    [actions.setExtensionEnabled as any]: (state, payload) =>
      setSafe(state, ['extensions', payload.extensionId, 'enabled'], payload.enabled),
    [actions.removeExtension as any]: (state, payload) =>
      setSafe(state, ['extensions', payload, 'remove'], true),
    [actions.forgetExtension as any]: (state, payload) =>
      deleteOrNop(state, ['extensions', payload]),
    [actions.setInstanceId as any]: (state, payload) =>
      setSafe(state, ['instanceId'], payload),
  },
  defaults: {
    instanceId: undefined,
    version: '',
    appVersion: '',
    extensions: {},
  },
  verifiers: {
    instanceId: { type: 'string' },
    version: { type: 'string' },
    appVersion: { type: 'string' },
    extensions: { noUndefined: true },
  },
};
