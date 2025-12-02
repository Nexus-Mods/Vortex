import { IModRule } from '../mod_management/types/IMod';
import { IDownload, IState } from '../../types/IState';

export function generateCollectionSessionId(collectionId: string, profileId: string): string {
  if (!profileId || !collectionId) {
    return null;
  }
  return `${collectionId}_${profileId}`;
}

export function modRuleId(input: IModRule): string {
  return input.type + '_' + (
    input.reference.tag
    || input.reference.fileMD5
    || input.reference.id
    || input.reference.logicalFileName
    || input.reference.fileExpression
    || input.reference.description
  );
}