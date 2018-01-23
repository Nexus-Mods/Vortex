import {IPlugins} from '../types/IPlugins';

import { createAction } from 'redux-act';

export const setPluginList =
    createAction('SET_PLUGIN_LIST', (plugins: IPlugins) => ({plugins}));
