import { types } from "@nexusmods/vortex-api";
import { RuleType } from "modmeta-db";

export interface IBiDirRule {
  source: types.IModReference;
  type: RuleType;
  reference: types.IModReference;
  original: boolean;
}
