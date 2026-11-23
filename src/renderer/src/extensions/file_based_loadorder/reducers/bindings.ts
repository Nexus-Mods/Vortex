import { type IReducerBinding, reducerBinding } from "../../../reducers/builder";
import { modLoadOrderReducer } from "./loadOrder";
import { multiLoadOrderReducer } from "./multiLoadOrder";
import { sessionReducer } from "./session";

// The reducer specs this extension owns, at their state paths; the test harness binds this list.
export const REDUCER_BINDINGS: IReducerBinding[] = [
  reducerBinding(["persistent", "loadOrder"], modLoadOrderReducer),
  reducerBinding(["persistent", "loadOrders"], multiLoadOrderReducer),
  reducerBinding(["session", "fblo"], sessionReducer),
];
