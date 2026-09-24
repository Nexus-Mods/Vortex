import type { IExtensionReducer } from "../../../types/extensions";
import { indexReducer } from "./indexlock";
import { loadOrderReducer } from "./loadOrder";
import { pluginsReducer } from "./plugins";
import { settingsReducer } from "./settings";
import userlistReducer from "./userlist";
import userlistEditReducer from "./userlistEdit";

/**
 * The reducer specs this extension owns, at their state paths. register() registers each, and the
 * gamebryo test harness binds the same list, so the two cannot drift.
 */
export const REDUCER_BINDINGS: IExtensionReducer[] = [
  { path: ["session", "plugins"], reducer: pluginsReducer },
  { path: ["loadOrder"], reducer: loadOrderReducer },
  { path: ["userlist"], reducer: userlistReducer },
  {
    path: ["masterlist"],
    reducer: { defaults: { globals: [], plugins: [], groups: [] }, reducers: {} },
  },
  { path: ["settings", "plugins"], reducer: settingsReducer },
  { path: ["session", "pluginDependencies"], reducer: userlistEditReducer },
  { path: ["persistent", "plugins", "lockedIndices"], reducer: indexReducer },
];
