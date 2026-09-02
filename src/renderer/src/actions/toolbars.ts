import { createAction } from "redux-act";

/** One decision about whether an action sits on a toolbar. */
interface IPinDecision {
  toolbarId: string;
  actionId: string;
  pinned: boolean;
}

/**
 * Pins an action to a toolbar, or takes it off. Only an action the user has decided
 * about is recorded — see the reducer — so a default we change later still reaches
 * everyone who never touched that action.
 */
export const setActionPinned = createAction(
  "SET_TOOLBAR_ACTION_PINNED",
  (decision: IPinDecision) => decision,
);

/** Forgets every decision the user made about one toolbar, restoring its defaults. */
export const resetPinnedActions = createAction(
  "RESET_TOOLBAR_PINNED_ACTIONS",
  (target: Pick<IPinDecision, "toolbarId">) => target,
);
