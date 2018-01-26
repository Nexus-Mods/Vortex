import { createAction } from 'redux-act';

export const addRule = createAction('ADD_USERLIST_RULE',
  (pluginId, reference, type) => ({ pluginId, reference, type }));

export const removeRule = createAction('REMOVE_USERLIST_RULE',
  (pluginId, reference, type) => ({ pluginId, reference, type }));

export const setLocalPriority = createAction('SET_PLUGIN_LOCAL_PRIORITY',
  (pluginId, priority) => ({ pluginId, priority }));

export const setGlobalPriority = createAction('SET_PLUGIN_GLOBAL_PRIORITY',
  (pluginId, priority) => ({ pluginId, priority }));
