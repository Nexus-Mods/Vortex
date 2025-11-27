import { ILoadOrder } from './ILoadOrder';
import { ILOOTList } from './ILOOTList';
import { IPluginDependencies, IPlugins } from './IPlugins';

import { types } from 'vortex-api';

const DummyState: types.IState = undefined;

export interface IStateEx extends types.IState {
  masterlist: ILOOTList;
  userlist: ILOOTList;
  session: typeof DummyState.session & {
    plugins: {
      pluginList: IPlugins,
    }
    pluginDependencies: IPluginDependencies;
  };
  loadOrder: { [pluginId: string]: ILoadOrder };
}
