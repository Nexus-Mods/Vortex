import { RuleType } from "modmeta-db";
import { types } from "vortex-api";

export interface IBiDirRule {
  source: types.IModReference;
  type: RuleType;
  reference: types.IModReference;
  original: boolean;
}
