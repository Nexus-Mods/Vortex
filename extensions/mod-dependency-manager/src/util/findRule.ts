import { types, util } from "vortex-api";
import { IBiDirRule } from "../types/IBiDirRule";
import { IModLookupInfo } from "../types/IModLookupInfo";

function findRule(
  modRules: IBiDirRule[],
  source: types.IMod,
  ref: IModLookupInfo,
): IBiDirRule {
  return modRules.find(
    (rule) =>
      (source === undefined || util.testModReference(source, rule.source)) &&
      util.testModReference(ref, rule.reference),
  );
}

export default findRule;
