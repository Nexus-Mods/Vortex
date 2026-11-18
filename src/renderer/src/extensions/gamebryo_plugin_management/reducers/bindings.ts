import { type IReducerBinding, reducerBinding } from "../../../reducers/builder";
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
export const REDUCER_BINDINGS: IReducerBinding[] = [
  reducerBinding(["session", "plugins"], pluginsReducer),
  reducerBinding(["loadOrder"], loadOrderReducer),
  reducerBinding(["userlist"], userlistReducer),
  {
    path: ["masterlist"],
    reducer: { defaults: { globals: [], plugins: [], groups: [] }, reducers: {} },
  },
  reducerBinding(["settings", "plugins"], settingsReducer),
  reducerBinding(["session", "pluginDependencies"], userlistEditReducer),
  reducerBinding(["persistent", "plugins", "lockedIndices"], indexReducer),
];
