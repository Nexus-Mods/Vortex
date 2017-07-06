import safeCreateAction from './safeCreateAction';

export const setStateVersion = safeCreateAction('SET_STATE_VERSION');

export const setExtensionEnabled = safeCreateAction('SET_EXTENSION_ENABLED',
  (extensionId: string, enabled: boolean) => ({ extensionId, enabled }));

export const removeExtension = safeCreateAction('REMOVE_EXTENSION');

export const forgetExtension = safeCreateAction('FORGET_EXTENSION');

export const setInstanceId = safeCreateAction('SET_INSTANCE_ID');
