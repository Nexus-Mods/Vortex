import type { IState } from "../../../types/IState";
import type { ILockedIndices } from "../reducers/indexlock";
import type { ILOOTList } from "./ILOOTList";
import type { IPluginLoadOrderEntry } from "./IPluginLoadOrderEntry";
import type { IPluginCombined, IPluginDependencies, IPlugins } from "./IPlugins";

// No idea what we need to do with this,
// do we keep the ex type here or move it somewhere?
export interface IStateWithGamebryo extends IState {
  masterlist: ILOOTList;
  userlist: ILOOTList;
  session: IState["session"] & {
    plugins?: {
      pluginList: IPlugins;
      pluginInfo: { [id: string]: IPluginCombined };
      newlyAddedPlugins: number;
    };
    pluginDependencies?: IPluginDependencies;
  };
  settings: IState["settings"] & {
    plugins?: {
      autoSort: boolean;
      autoEnable: boolean;
      pluginManagementEnabled: { [profileId: string]: boolean };
    };
  };
  persistent: IState["persistent"] & {
    plugins?: {
      lockedIndices: ILockedIndices;
    };
  };
  loadOrder: { [pluginId: string]: IPluginLoadOrderEntry };
}
