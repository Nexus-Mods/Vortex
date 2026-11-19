import { actionsToPartialReducerSpec } from "../../../reducers/builder";
import type { IStateTransactions } from "../../../types/IState";
import * as actions from "../actions/transactions";

/**
 * Partial: download_management registers on the same slice for its own transfer, and nothing
 * supplies a default for `transfer`, so it may be missing until the first transfer is recorded.
 */
export const transactionsReducer = actionsToPartialReducerSpec<IStateTransactions, typeof actions>(
  {
    pendingPluginSort: {},
  },
  actions,
  {
    setTransferMods: (state, payload) => {
      const { gameId, destination } = payload;
      if (destination === undefined || destination === "") {
        const transfer: Record<string, string> | undefined = state.transfer;
        if (transfer === undefined || !Object.hasOwn(transfer, gameId)) {
          return state;
        }
        const { [gameId]: _, ...rest } = transfer;
        return { ...state, transfer: rest };
      }
      return { ...state, transfer: { ...state.transfer, [gameId]: destination } };
    },
    setPendingPluginSort: (state, payload) => {
      const { profileId, collectionId, time } = payload;
      return {
        ...state,
        pendingPluginSort: {
          ...state.pendingPluginSort,
          [profileId]: { ...state.pendingPluginSort[profileId], [collectionId]: time },
        },
      };
    },
    clearPendingPluginSort: (state, payload) => {
      const { profileId } = payload;
      if (state.pendingPluginSort?.[profileId] === undefined) {
        return state;
      }
      const { [profileId]: _, ...pendingPluginSort } = state.pendingPluginSort;
      return { ...state, pendingPluginSort };
    },
  },
);
