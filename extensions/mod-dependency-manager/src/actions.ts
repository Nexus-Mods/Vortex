import { IBiDirRule } from "./types/IBiDirRule";

import { IReference, RuleType } from "modmeta-db";
import { createAction } from "redux-act";

export const setSource = createAction(
  "SET_MOD_CONNECTION_SOURCE",
  (id: string, pos: { x: number; y: number }) => ({ id, pos }),
);

export const setTarget = createAction(
  "SET_MOD_CONNECTION_TARGET",
  (id: string, pos: { x: number; y: number }) => ({ id, pos }),
);

export const setCreateRule = createAction(
  "SET_MOD_CREATE_RULE",
  (
    gameId: string,
    modId: string,
    reference: IReference,
    defaultType: string,
  ) => ({ gameId, modId, reference, type: defaultType }),
);

export const closeDialog = createAction("CLOSE_MOD_DEPENDENCY_DIALOG");

export const setType = createAction<RuleType, {}>("SET_MOD_RULE_TYPE");

export const highlightConflictIcon = createAction<boolean, {}>(
  "HIGHLIGHT_CONFLICT_ICON",
);

export const setConflictInfo = createAction<any, {}>("SET_CONFLICT_INFO");

export const setConflictDialog = createAction(
  "SET_CONFLICT_DIALOG",
  (gameId: string, modIds: string[], modRules: IBiDirRule[]) => ({
    gameId,
    modIds,
    modRules,
  }),
);

export const setFileOverrideDialog = createAction(
  "SET_FILE_OVERRIDE_DIALOG",
  (gameId: string, modId: string) => ({ gameId, modId }),
);

export const setEditCycle = createAction(
  "SET_EDIT_MOD_CYCLE",
  (gameId: string, modIds: string[]) =>
    gameId !== undefined ? { gameId, modIds } : undefined,
);

export const setModTypeConflictsSetting = createAction(
  "SET_MOD_TYPE_CONFLICTS_SETTING",
  (enabled: boolean) => ({ enabled }),
);

export const setHasUnsolvedConflicts = createAction(
  "SET_HAS_UNSOLVED_CONFLICTS",
  (hasUnsolvedConflicts: boolean) => ({ hasUnsolvedConflicts }),
);
