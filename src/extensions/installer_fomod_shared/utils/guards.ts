import { IFOMODState } from '../types/interface';
import { IState } from '../../../types/api';
import { nameof } from '../../../util/nameof';

type IStateSession = IState['session'];

interface IStateSessionWithFOMOD extends IStateSession {
  fomod: IFOMODState;
}

export const hasSessionFOMOD = (
  stateSession: IStateSession
): stateSession is IStateSessionWithFOMOD =>
  nameof<IStateSessionWithFOMOD>('fomod') in stateSession;