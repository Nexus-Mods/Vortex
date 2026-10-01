import * as actions from "../actions/devTools";
import type { DevSetting } from "../actions/devTools";
import { actionsToReducerSpec } from "./builder";

/** The dev tools menu's switches. Session-only, so a restart turns them all off. */
export type IDevToolsState = Record<DevSetting, boolean>;

declare module "@/types/IState" {
  interface ISessionState {
    devTools: IDevToolsState;
  }
}

const defaultState: IDevToolsState = {
  newTable: false,
};

export const devToolsReducer = actionsToReducerSpec(defaultState, actions, {
  setDevSetting: (state, { name, value }) => ({ ...state, [name]: value }),
});
