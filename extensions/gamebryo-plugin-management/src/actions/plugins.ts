import { createAction } from 'redux-act';

export const setPluginList: any = createAction('SET_PLUGIN_LIST',
    (profile, plugins) => ({ profile, plugins }));

export const setPluginEnabled: any = createAction('SET_PLUGIN_ENABLED',
    (pluginName: string, enabled: boolean) => ({ pluginName, enabled }));
