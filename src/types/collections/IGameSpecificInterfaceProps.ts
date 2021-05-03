import { IRevision } from '@nexusmods/nexus-api';
import * as types from '../api';

export interface IGameSpecificInterfaceProps {
  t: types.TFunction;
  collection: types.IMod;
  revisionInfo: IRevision;
}