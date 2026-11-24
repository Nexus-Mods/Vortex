import { actionsToPartialReducerSpec } from "../../../reducers/builder";
import type { IStateTransactions } from "../../../types/IState";
import * as actions from "../actions/transactions";

/**
 * Partial: mod_management owns the rest of the transactions slice. This only records the
 * download folder transfer, as transfer.downloads.
 */
export const transactionsReducer = actionsToPartialReducerSpec<IStateTransactions, typeof actions>(
  {},
  actions,
  {
    setTransferDownloads: (state, payload) => {
      const { destination } = payload;
      if (destination === undefined || destination === "") {
        const transfer: Record<string, string> | undefined = state.transfer;
        if (transfer === undefined || !Object.hasOwn(transfer, "downloads")) {
          return state;
        }
        const { downloads: _, ...rest } = transfer;
        return { ...state, transfer: rest };
      }
      return { ...state, transfer: { ...state.transfer, downloads: destination } };
    },
  },
);
