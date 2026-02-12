import { ILoadOrder } from "./ILoadOrder";
import { ILOOTList } from "./ILOOTList";
import { IPluginCombined, IPluginDependencies, IPlugins } from "./IPlugins";

import { types } from "vortex-api";

// No idea what we need to do with this,
// do we keep the ex type here or move it to base?
export interface IStateWithGamebryo extends types.IState {
  masterlist: ILOOTList;
  userlist: ILOOTList;
  session: types.IState["session"] & {
    plugins?: {
      pluginList: IPlugins;
      pluginInfo: { [id: string]: IPluginCombined };
      newlyAddedPlugins: number;
    };
    pluginDependencies?: IPluginDependencies;
  };
  settings: types.IState["settings"] & {
    plugins?: {
      autoSort: boolean;
      autoEnable: boolean;
      pluginManagementEnabled: { [profileId: string]: boolean };
    };
  };
  loadOrder: { [pluginId: string]: ILoadOrder };
}
