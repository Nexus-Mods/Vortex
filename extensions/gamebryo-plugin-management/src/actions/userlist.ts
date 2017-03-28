import { safeCreateAction } from 'nmm-api';

export const addRule = safeCreateAction('ADD_USERLIST_RULE',
  (gameId, pluginId, reference, type) => ({ gameId, pluginId, reference, type }));

export const removeRule = safeCreateAction('REMOVE_USERLIST_RULE',
  (gameId, pluginId, reference, type) => ({ gameId, pluginId, reference, type }));
