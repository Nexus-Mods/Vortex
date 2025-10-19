import { IRevision } from '@nexusmods/nexus-api';
// Import specific types instead of the entire api module to avoid circular dependencies
import { TFunction } from '../../util/i18n';
import { IMod } from '../IState';

export interface IGameSpecificInterfaceProps {
  t: TFunction;
  collection: IMod;
  revisionInfo: IRevision;
}