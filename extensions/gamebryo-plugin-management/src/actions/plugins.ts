import { safeCreateAction } from 'nmm-api';

export const setPluginList: any = safeCreateAction('SET_PLUGIN_LIST',
    (plugins) => ({ plugins }));

export const setLootActivity: any = safeCreateAction('SET_LOOT_ACTIVITY');
