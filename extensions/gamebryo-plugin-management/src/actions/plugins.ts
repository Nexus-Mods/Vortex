import { safeCreateAction } from 'nmm-api';

export const setPluginList = safeCreateAction('SET_PLUGIN_LIST',
    (plugins) => ({ plugins }));

export const setLootActivity = safeCreateAction('SET_LOOT_ACTIVITY');
