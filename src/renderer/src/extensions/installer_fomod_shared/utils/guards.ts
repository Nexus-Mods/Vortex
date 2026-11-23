import type { IState } from "../../../types/api";
import type { IFOMODState } from "../types/interface";

type IStateSession = IState["session"];

interface IStateSessionWithFOMOD extends IStateSession {
  fomod: IFOMODState;
}

export const hasSessionFOMOD = (
  stateSession: IStateSession,
): stateSession is IStateSessionWithFOMOD => "fomod" in stateSession;

// session.plugins and the top-level loadOrder are declared by gamebryo_plugin_management, but only
// exist while a gamebryo game is managed, so these check for them at runtime
export const hasSessionPlugins = (stateSession: IStateSession): boolean =>
  "plugins" in stateSession;

export const hasLoadOrder = (state: IState): boolean => "loadOrder" in state;
