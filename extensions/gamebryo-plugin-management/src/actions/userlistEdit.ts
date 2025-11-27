import { createAction } from 'redux-act';

export const setSource = createAction('SET_PLUGIN_CONNECTION_SOURCE',
  (id: string, pos: { x: number, y: number }) => ({ id, pos }));

export const setTarget = createAction('SET_PLUGIN_CONNECTION_TARGET',
  (id: string, pos: { x: number, y: number }) => ({ id, pos }));

export const setCreateRule = createAction('SET_PLUGIN_CREATE_RULE',
  (pluginId: string, reference: string, defaultType: string) =>
    ({ pluginId, reference, type: defaultType }));

export const closeDialog = createAction('CLOSE_PLUGIN_RULE_DIALOG');

export const openGroupEditor = createAction('CLOSE_GROUP_EDITOR',
  (open: boolean) => open);

export const setQuickEdit = createAction('SET_USERLIST_QUICK_EDIT',
  (pluginId: string, mode: string) => ({ pluginId, mode }));
