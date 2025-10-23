import { IModRule } from '../mod_management/types/IMod';

export function generateCollectionSessionId(collectionId: string, profileId: string): string {
  return `${collectionId}_${profileId}`;
}

export function modRuleId(input: IModRule): string {
  return input.type + '_' + (
    input.reference.fileMD5
    || input.reference.id
    || input.reference.logicalFileName
    || input.reference.fileExpression
    || input.reference.description
  );
}