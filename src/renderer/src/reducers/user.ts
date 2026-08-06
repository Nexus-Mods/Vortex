import * as actions from "../actions/user";
import { actionsToReducerSpec } from "./builder";

export const userReducer = actionsToReducerSpec(
  {
    multiUser: false,
  },
  actions,
  {
    setMultiUser: (state, payload) => ({ ...state, multiUser: payload }),
  },
  {
    multiUser: {
      description: () =>
        'Choice of "shared"/"per-user" mode was not stored, defaulting to "per-user" mode.',
      type: "boolean",
    },
  },
);
