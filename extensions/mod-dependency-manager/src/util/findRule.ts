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

/**
 * Like findRule but checks both directions: a rule from source→ref OR ref→source.
 * Use this when checking if a conflict pair has been resolved in either direction.
 */
export function findRuleBiDir(
  modRules: IBiDirRule[],
  source: types.IMod,
  ref: IModLookupInfo,
): IBiDirRule {
  return modRules.find(
    (rule) =>
      ((source === undefined || util.testModReference(source, rule.source)) &&
        util.testModReference(ref, rule.reference)) ||
      (util.testModReference(ref, rule.source) &&
        (source === undefined ||
          util.testModReference(source, rule.reference))),
  );
}

const CONFLICT_RULE_TYPES = ["before", "after", "conflicts"];

/**
 * Check if a conflict between two mods is resolved by directly inspecting
 * mod.rules on both mods. This is more reliable than findRuleBiDir for
 * id-based rules because it doesn't require matching the rule source
 * against the mod's attributes (which can fail when makeModReference
 * produces a reference without an id field).
 */
export function isConflictResolved(
  mods: { [modId: string]: types.IMod },
  modId: string,
  otherMod: IModLookupInfo,
): boolean {
  // Check if modId has a rule referencing otherMod
  const modRules = mods[modId]?.rules ?? [];
  if (
    modRules.some(
      (rule) =>
        CONFLICT_RULE_TYPES.includes(rule.type) &&
        util.testModReference(otherMod, rule.reference),
    )
  ) {
    return true;
  }

  // Check if otherMod has a rule referencing modId (reverse direction)
  const otherModRules = mods[otherMod.id]?.rules ?? [];
  if (
    mods[modId] !== undefined &&
    otherModRules.some(
      (rule) =>
        CONFLICT_RULE_TYPES.includes(rule.type) &&
        util.testModReference(mods[modId], rule.reference),
    )
  ) {
    return true;
  }

  return false;
}

export default findRule;
