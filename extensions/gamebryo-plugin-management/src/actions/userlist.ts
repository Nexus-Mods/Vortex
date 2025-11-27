import { createAction } from 'redux-act';

export const addRule = createAction('ADD_USERLIST_RULE',
  (pluginId, reference, type) => ({ pluginId, reference, type }));

export const removeRule = createAction('REMOVE_USERLIST_RULE',
  (pluginId, reference, type) => ({ pluginId, reference, type }));

export const addGroup = createAction('ADD_PLUGIN_GROUP',
  (group: string) => ({ group }));

export const removeGroup = createAction('REMOVE_PLUGIN_GROUP',
  (group: string) => ({ group }));

export const setGroup = createAction('SET_PLUGIN_GROUP',
  (pluginId: string, group: string) => ({ pluginId, group }));

export const addGroupRule = createAction('ADD_GROUP_RULE',
  (groupId: string, reference: string) => ({ groupId, reference }));

export const removeGroupRule = createAction('REMOVE_GROUP_RULE',
  (groupId: string, reference: string) => ({ groupId, reference }));
