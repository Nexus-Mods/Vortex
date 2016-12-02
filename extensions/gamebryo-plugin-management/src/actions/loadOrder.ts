import { createAction } from 'redux-act';

export const setPluginEnabled: any = createAction('SET_PLUGIN_ENABLED',
    (pluginName: string, enabled: boolean) => ({ pluginName, enabled }));
