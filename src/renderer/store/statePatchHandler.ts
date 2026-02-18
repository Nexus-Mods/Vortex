import type { Store } from "redux";

import type { IState } from "../../types/IState";

/**
 * Set up the generic state:patch handler.
 *
 * Listens for state:patch IPC events from the main process and dispatches
 * __apply_patch actions to apply DiffOperations to the Redux store.
 *
 * The persist-diff middleware skips __apply_patch actions to avoid
 * re-persisting data that was just written by a command handler.
 */
export function setupStatePatchHandler(store: Store<IState>): void {
  window.api.persist.onPatch((hive, operations) => {
    store.dispatch({
      type: "__apply_patch",
      payload: { hive, operations },
    });
  });
}
