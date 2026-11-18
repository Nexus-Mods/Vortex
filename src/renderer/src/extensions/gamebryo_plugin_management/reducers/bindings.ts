import { type IReducerBinding, reducerBinding } from "../../../reducers/builder";
import type { IReducerSpec } from "../../../types/IExtensionContext";
import type { ILOOTList } from "../types/ILOOTList";
import { indexReducer } from "./indexlock";
import { loadOrderReducer } from "./loadOrder";
import { pluginsReducer } from "./plugins";
import { settingsReducer } from "./settings";
import userlistReducer from "./userlist";
import userlistEditReducer from "./userlistEdit";

declare module "@/types/IState" {
  interface IState {
    // the LOOT masterlist, filled from the masterlist file by its persistor; no action writes it
    masterlist: ILOOTList;
  }
}

const masterlistReducer: IReducerSpec<ILOOTList> = {
  defaults: { globals: [], plugins: [], groups: [] },
  reducers: {},
};

/**
 * The reducer specs this extension owns, at their state paths. register() registers each, and the
 * gamebryo test harness binds the same list, so the two cannot drift.
 */
export const REDUCER_BINDINGS: IReducerBinding[] = [
  reducerBinding(["session", "plugins"], pluginsReducer),
  reducerBinding(["loadOrder"], loadOrderReducer),
  reducerBinding(["userlist"], userlistReducer),
  reducerBinding(["masterlist"], masterlistReducer),
  reducerBinding(["settings", "plugins"], settingsReducer),
  reducerBinding(["session", "pluginDependencies"], userlistEditReducer),
  reducerBinding(["persistent", "plugins", "lockedIndices"], indexReducer),
];
