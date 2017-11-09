import { createAction } from 'redux-act';

export const setPluginEnabled = createAction('SET_PLUGIN_ENABLED',
    (pluginName: string, enabled: boolean) => ({ pluginName, enabled }));

/**
 * completely replace the load order (not changing the enabled state of plugins)
 */
export const setPluginOrder = createAction('SET_PLUGIN_ORDER');
