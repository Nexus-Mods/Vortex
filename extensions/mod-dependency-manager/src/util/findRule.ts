import { types, util } from 'vortex-api';
import { IBiDirRule } from '../types/IBiDirRule';
import { IModLookupInfo } from '../types/IModLookupInfo';

function findRule(modRules: IBiDirRule[], source: types.IMod, ref: IModLookupInfo): IBiDirRule {
  return modRules.find(rule =>
    ((source === undefined) || util.testModReference(source, rule.source))
    && util.testModReference(ref, rule.reference));
}

/**
 * Like findRule but checks both directions: a rule from source→ref OR ref→source.
 * Use this when checking if a conflict pair has been resolved in either direction.
 */
export function findRuleBiDir(modRules: IBiDirRule[], source: types.IMod,
                              ref: IModLookupInfo): IBiDirRule {
  return modRules.find(rule =>
    (((source === undefined) || util.testModReference(source, rule.source))
      && util.testModReference(ref, rule.reference))
    || (util.testModReference(ref, rule.source)
      && ((source === undefined) || util.testModReference(source, rule.reference))));
}

export default findRule;
