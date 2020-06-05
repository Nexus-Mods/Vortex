import * as reduxAct from 'redux-act';

import safeCreateAction from './safeCreateAction';

const id = input => input;

export const setStateVersion = safeCreateAction('SET_STATE_VERSION',
  version => version);

export const setApplicationVersion = safeCreateAction('SET_APPLICATION_VERSION',
  version => version);

export const setExtensionEnabled = safeCreateAction('SET_EXTENSION_ENABLED',
  (extensionId: string, enabled: boolean) => ({ extensionId, enabled }));

export const setExtensionVersion = safeCreateAction('SET_EXTENSION_VERSION',
  (extensionId: string, version: string) => ({ extensionId, version }));

export const setExtensionEndorsed = safeCreateAction('SET_EXTENSION_ENDORSED',
  (extensionId: string, endorsed: string) => ({ extensionId, endorsed }));

export const removeExtension = safeCreateAction('REMOVE_EXTENSION', id);

export const forgetExtension = safeCreateAction('FORGET_EXTENSION', id);

export const completeMigration = safeCreateAction('COMPLETE_MIGRATION', id);

export const setInstanceId = safeCreateAction('SET_INSTANCE_ID', id);

export const setWarnedAdmin = safeCreateAction('SET_WARNED_ADMIN', id);
