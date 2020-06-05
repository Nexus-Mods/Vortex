import * as actions from '../actions/app';
import {IReducerSpec} from '../types/IExtensionContext';
import {deleteOrNop, pushSafe, setSafe} from '../util/storeHelper';

import {app} from 'electron';

export const appReducer: IReducerSpec = {
  reducers: {
    [actions.setStateVersion as any]: (state, payload) => setSafe(state, ['version'], payload),
    [actions.setApplicationVersion as any]:
      (state, payload) => setSafe(state, ['appVersion'], payload),
    [actions.setExtensionEnabled as any]: (state, payload) =>
      setSafe(state, ['extensions', payload.extensionId, 'enabled'], payload.enabled),
    [actions.setExtensionVersion as any]: (state, payload) =>
      setSafe(state, ['extensions', payload.extensionId, 'version'], payload.version),
    [actions.setExtensionEndorsed as any]: (state, payload) =>
      setSafe(state, ['extensions', payload.extensionId, 'endorsed'], payload.endorsed),
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
    instanceId: {
      description: () => 'No instance id set',
      type: 'string',
    },
    version: {
      description: () => 'Version not set',
      type: 'string',
    },
    appVersion: {
      description: () => 'Application version not set',
      type: 'string',
    },
    extensions: {
      description: () => 'Resetting list of disabled extensions',
      noUndefined: true,
    },
  },
};
