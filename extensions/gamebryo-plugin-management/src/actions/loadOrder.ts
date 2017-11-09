import { createAction } from 'redux-act';

export const setPluginEnabled = createAction('SET_PLUGIN_ENABLED',
    (pluginName: string, enabled: boolean) => ({ pluginName, enabled }));

/**
 * updates the load order based on a list of plugin names. Stored plugins that
 * are not in this list will be deleted, default entries are created for those
 * that are in the list but not stored
 */
// export const updateLoadOrder = createAction('UPDATE_LOAD_ORDER');

/**
 * completely replace the load order (not changing the enabled state of plugins)
 */
export const setPluginOrder = createAction('SET_PLUGIN_ORDER');
