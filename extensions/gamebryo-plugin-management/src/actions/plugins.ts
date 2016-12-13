import {createAction} from 'redux-act';

export const setPluginList: any = createAction('SET_PLUGIN_LIST',
    (plugins) => ({ plugins }));

export const setLootActivity: any = createAction('SET_LOOT_ACTIVITY');
