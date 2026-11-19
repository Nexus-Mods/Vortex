import type { VortexGameId } from "@nexusmods/vortex-api";
import type { IReference, RuleType } from "modmeta-db";

import type { IBiDirRule } from "./IBiDirRule";
import type { IConflict } from "./IConflict";

/** One end of the rule line the user is dragging between two mods. */
export interface IConnectionEnd {
  id: string;
  pos: { x: number; y: number };
}

export interface IConnection {
  source?: IConnectionEnd;
  target?: IConnectionEnd;
}

export interface IRuleDialog {
  gameId: VortexGameId;
  modId: string;
  reference: IReference;
  type: RuleType;
}

export interface IConflictDialog {
  gameId: VortexGameId;
  modIds: string[];
  modRules: IBiDirRule[];
}

export interface IOverrideDialog {
  gameId: VortexGameId;
  modId: string;
}

export interface IEditCycle {
  gameId: VortexGameId;
  modIds: string[];
}

/** `session.dependencies` */
export interface IDependenciesSessionState {
  connection: IConnection | undefined;
  dialog: IRuleDialog | undefined;
  highlightConflicts: boolean;
  /** conflicts of the active game's mods, by mod id */
  conflicts: { [modId: string]: IConflict[] } | undefined;
  conflictDialog: IConflictDialog | undefined;
  overrideDialog: IOverrideDialog | undefined;
  editCycle: IEditCycle | undefined;
  unsolvedConflictsCount: number;
  hasUnsolvedConflicts: boolean;
}

declare module "@nexusmods/vortex-api" {
  namespace types {
    interface ISessionState {
      dependencies: IDependenciesSessionState;
    }
    /** The field of `settings.workarounds` this extension owns; core owns the rest. */
    interface ISettingsWorkarounds {
      modTypeConflictsEnabled: boolean;
    }
  }
}
