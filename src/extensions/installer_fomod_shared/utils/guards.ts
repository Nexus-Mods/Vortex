import type { IFOMODState, IPluginState } from "../types/interface";
import type { IState } from "../../../renderer/types/api";

type IStateSession = IState["session"];

interface IStateSessionWithFOMOD extends IStateSession {
  fomod: IFOMODState;
}

export const hasSessionFOMOD = (
  stateSession: IStateSession,
): stateSession is IStateSessionWithFOMOD => "fomod" in stateSession;

interface IStateSessionWithPlugins extends IStateSession {
  plugins: IPluginState;
}

export const hasSessionPlugins = (
  stateSession: IStateSession,
): stateSession is IStateSessionWithPlugins => "plugins" in stateSession;

interface IStateWithLoadOrder extends IState {
  loadOrder: {
    [pluginId: string]: {
      name?: string;
      enabled?: boolean;
      loadOrder: number;
    };
  };
}

export const hasLoadOrder = (state: IState): state is IStateWithLoadOrder =>
  "loadOrder" in state;
