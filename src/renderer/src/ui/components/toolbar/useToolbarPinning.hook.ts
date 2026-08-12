import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import { resetPinnedActions, setActionPinned } from "@/actions/toolbars";
import { log } from "@/logging";
import type { IState } from "@/types/IState";

import { useToolbarContext } from "./Toolbar.context";
import type { IToolbarAction } from "./ToolbarGroup";

const NO_DECISIONS: { [actionId: string]: boolean } = {};

export interface IToolbarPinning {
  /** Whether the user has a say here at all — see `Toolbar`'s `pinningId`. */
  enabled: boolean;
  /** The actions to put on the bar, in the order they were given. */
  pinnedActions: IToolbarAction[];
  isPinned: (action: IToolbarAction) => boolean;
  togglePin: (action: IToolbarAction) => void;
  /** Whether anything has been decided, which is what a reset would undo. */
  canReset: boolean;
  reset: () => void;
}

/**
 * Resolves what the user decided about a toolbar's actions against what each action
 * asks for by default, and hands back the actions belonging on the bar.
 *
 * A decision is only stored for an action the user actually pinned or unpinned, so
 * everything else follows its own `pinned` default. An action needs an `id` to be
 * decided about — that is what the decision is stored against — and one without is
 * treated as pinned so that a toolbar offering pinning never silently drops it.
 */
export const useToolbarPinning = (actions: IToolbarAction[]): IToolbarPinning => {
  const { pinningId } = useToolbarContext();
  const dispatch = useDispatch();

  const decisions = useSelector(
    (state: IState) =>
      (pinningId === null ? undefined : state.settings.toolbars[pinningId]?.pinned) ?? NO_DECISIONS,
  );

  const isPinned = useCallback(
    (action: IToolbarAction) => {
      if (action.id === undefined) {
        if (pinningId !== null) {
          log("warn", "toolbar action cannot be pinned without an id", {
            pinningId,
            label: action.label,
          });
        }

        return true;
      }

      return decisions[action.id] ?? action.pinned ?? false;
    },
    [decisions, pinningId],
  );

  const togglePin = useCallback(
    (action: IToolbarAction) => {
      if (pinningId === null || action.id === undefined) {
        return;
      }

      dispatch(setActionPinned(pinningId, action.id, !isPinned(action)));
    },
    [dispatch, isPinned, pinningId],
  );

  const reset = useCallback(() => {
    if (pinningId !== null) {
      dispatch(resetPinnedActions(pinningId));
    }
  }, [dispatch, pinningId]);

  const pinnedActions = useMemo(
    () => (pinningId === null ? actions : actions.filter((action) => isPinned(action))),
    [actions, isPinned, pinningId],
  );

  return {
    enabled: pinningId !== null,
    pinnedActions,
    isPinned,
    togglePin,
    canReset: Object.keys(decisions).length > 0,
    reset,
  };
};
