import { createAction } from 'redux-act';

/**
 * enables or disables autosort
 */
export const setAutoSortEnabled = createAction('GAMEBRYO_SET_AUTOSORT_ENABLED', enabled => enabled);

export const setAutoEnable = createAction('GAMEBRYO_SET_AUTO_ENABLE', enable => enable);

export const setPluginManagementEnabled = createAction('GAMEBRYO_SET_PLUGIN_MANAGEMENT_ENABLED',
  (profileId: string, enabled: boolean) => ({ profileId, enabled }));
