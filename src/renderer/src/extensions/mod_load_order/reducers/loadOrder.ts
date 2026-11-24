import { actionsToReducerSpec } from "../../../reducers/builder";
// declares persistent.loadOrder, which this page shares with the file-based load order
import type { PersistentLoadOrders } from "../../file_based_loadorder/reducers/loadOrder";
import * as actions from "../actions/loadOrder";

export const modLoadOrderReducer = actionsToReducerSpec<PersistentLoadOrders, typeof actions>(
  {},
  actions,
  {
    setLoadOrderEntry: (state, payload) => {
      const { profileId, modId, loEntry } = payload;
      const current = state[profileId];
      return {
        ...state,
        // a profile holding another system's array keeps it an array, with the entry as a key
        [profileId]: Array.isArray(current)
          ? Object.assign(current.slice(), { [modId]: loEntry })
          : { ...current, [modId]: loEntry },
      };
    },
  },
);
