import * as actions from "../actions/notificationSettings";
import { actionsToReducerSpec } from "./builder";

const defaultState = {
  suppress: {} as Record<string, boolean>,
};

export const notificationSettingsReducer = actionsToReducerSpec(defaultState, actions, {
  suppressNotification: (state, payload) => ({
    ...state,
    suppress: { ...state.suppress, [payload.id]: payload.suppress },
  }),
  resetSuppression: (state) => ({ ...state, suppress: {} }),
});
