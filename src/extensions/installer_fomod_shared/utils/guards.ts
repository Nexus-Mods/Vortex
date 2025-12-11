import { IFOMODState, IPluginState } from "../types/interface";
import { IState } from "../../../types/api";
import { nameof } from "../../../util/nameof";

type IStateSession = IState["session"];

interface IStateSessionWithFOMOD extends IStateSession {
  fomod: IFOMODState;
}

export const hasSessionFOMOD = (
  stateSession: IStateSession,
): stateSession is IStateSessionWithFOMOD =>
  nameof<IStateSessionWithFOMOD>("fomod") in stateSession;

interface IStateSessionWithPlugins extends IStateSession {
  plugins: IPluginState;
}

export const hasSessionPlugins = (
  stateSession: IStateSession,
): stateSession is IStateSessionWithPlugins =>
  nameof<IStateSessionWithPlugins>("plugins") in stateSession;

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
  nameof<IStateWithLoadOrder>("loadOrder") in state;
