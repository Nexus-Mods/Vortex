import { safeCreateAction } from 'nmm-api';

export const setSource = safeCreateAction('SET_PLUGIN_CONNECTION_SOURCE',
  (id: string, pos: { x: number, y: number }) => ({ id, pos }));

export const setTarget = safeCreateAction('SET_PLUGIN_CONNECTION_TARGET',
  (id: string, pos: { x: number, y: number }) => ({ id, pos }));

export const setCreateRule = safeCreateAction('SET_PLUGIN_CREATE_RULE',
  (gameId: string, pluginId: string, reference: string, defaultType: string) =>
    ({ gameId, pluginId, reference, type: defaultType }));

export const closeDialog = safeCreateAction('CLOSE_PLUGIN_RULE_DIALOG');
