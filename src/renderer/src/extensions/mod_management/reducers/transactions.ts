import update from "immutability-helper";

import type { IReducerSpec } from "../../../types/IExtensionContext";
import { deleteOrNop, setSafe } from "../../../util/storeHelper";
import * as actions from "../actions/transactions";

export const transactionsReducer: IReducerSpec = {
  reducers: {
    [actions.setTransferMods as any]: (state, payload) => {
      const { gameId, destination } = payload;
      return destination === undefined || destination === ""
        ? deleteOrNop(state, ["transfer", gameId])
        : setSafe(state, ["transfer", gameId], destination);
    },
    [actions.setPendingPluginSort as any]: (state, payload) => {
      const { profileId, collectionId, time } = payload;
      return update(state, {
        pendingPluginSort: {
          [profileId]: { $apply: (prof) => ({ ...(prof ?? {}), [collectionId]: time }) },
        },
      });
    },
    [actions.clearPendingPluginSort as any]: (state, payload) => {
      const { profileId } = payload;
      if (state.pendingPluginSort?.[profileId] === undefined) {
        return state;
      }
      return update(state, { pendingPluginSort: { $unset: [profileId] } });
    },
  },
  defaults: {
    pendingPluginSort: {},
  },
};
