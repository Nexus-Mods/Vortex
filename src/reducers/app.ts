import * as actions from '../actions/app';
import {IReducerSpec} from '../types/IExtensionContext';
import {deleteOrNop, setSafe, pushSafe} from '../util/storeHelper';

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
    [actions.setWarnedAdmin as any]: (state, payload) =>
      setSafe(state, ['warnedAdmin'], payload),
    [actions.completeMigration as any]: (state, payload) =>
      pushSafe(state, ['migrations'], payload),
  },
  defaults: {
    instanceId: undefined,
    version: '',
    appVersion: '',
    extensions: {},
    warnedAdmin: 0,
    migrations: [],
  },
  verifiers: {
    instanceId: { type: 'string' },
    version: { type: 'string' },
    appVersion: { type: 'string' },
    extensions: { noUndefined: true },
  },
};
