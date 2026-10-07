import type { IExtensionReducer } from "../../../types/extensions";
import { modLoadOrderReducer } from "./loadOrder";
import { multiLoadOrderReducer } from "./multiLoadOrder";
import { sessionReducer } from "./session";

// The reducer specs this extension owns, at their state paths; the test harness binds this list.
export const REDUCER_BINDINGS: IExtensionReducer[] = [
  { path: ["persistent", "loadOrder"], reducer: modLoadOrderReducer },
  { path: ["persistent", "loadOrders"], reducer: multiLoadOrderReducer },
  { path: ["session", "fblo"], reducer: sessionReducer },
];
