import safeCreateAction from './safeCreateAction';

export const setStateVersion = safeCreateAction('SET_STATE_VERSION');

export const setExtensionEnabled = safeCreateAction('SET_EXTENSION_ENABLED',
  (extensionId: string, enabled: boolean) => ({ extensionId, enabled }));
