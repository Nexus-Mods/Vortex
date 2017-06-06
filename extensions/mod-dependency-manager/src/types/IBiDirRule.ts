import { IReference, RuleType } from 'modmeta-db';

export interface IBiDirRule {
  source: IReference;
  type: RuleType;
  reference: IReference;
  original: boolean;
}
