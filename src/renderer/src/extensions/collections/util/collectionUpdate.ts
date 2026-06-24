import type { IMod, IModRule } from "../../mod_management/types/IMod";
import { findModByRef } from "../../mod_management/util/findModByRef";
import {
  findRuleByRef,
  isDependencyRule,
  isOptionalRule,
} from "../../mod_management/util/testModReference";
import type { IProfileMod } from "../../profile_management/types/IProfile";

/**
 * The installed mods a revision pulled in as dependencies. A mod qualifies when a
 * requires/recommends rule resolves to it and it carries the installedAsDependency marker, so mods
 * the user installed themselves are excluded.
 */
export function findInstalledDependencyMembers(
  rules: IModRule[],
  mods: Record<string, IMod>,
): IMod[] {
  return rules
    .filter(isDependencyRule)
    .map((rule) => findModByRef(rule.reference, mods))
    .filter((mod) => mod !== undefined && mod.attributes?.["installedAsDependency"] === true);
}

/**
 * Of the old revision's dependency members (`candidates`), the ones the new revision no longer
 * needs: a member the new revision's rules don't reference and that no other installed mod's rules
 * reference either.
 */
export function findObsoleteMembers(
  candidates: IMod[],
  newRules: IModRule[],
  mods: Record<string, IMod>,
  oldModId: string,
): IMod[] {
  const newDependencyRules = newRules.filter(isDependencyRule);
  // every other installed mod's dependency rules, filtered once up front so the per-candidate scan
  // below never refilters
  const otherDependencyRules = Object.values(mods)
    .filter((mod) => !candidates.includes(mod) && mod.id !== oldModId)
    .flatMap((mod) => mod.rules?.filter(isDependencyRule) ?? []);

  return candidates.filter(
    (mod) =>
      findRuleByRef(newDependencyRules, mod) === undefined &&
      findRuleByRef(otherDependencyRules, mod) === undefined,
  );
}

/** The remove/keep split of a member-removal review dialog's checkbox result, keyed by mod id. */
export interface IReviewSelection {
  remove: string[];
  keep: string[];
}

/**
 * Partition the member-removal review dialog's result: checked entries are removed, unchecked are
 * kept.
 */
export function partitionReviewSelection(input: Record<string, boolean>): IReviewSelection {
  const result: IReviewSelection = { remove: [], keep: [] };
  for (const [modId, selected] of Object.entries(input)) {
    (selected ? result.remove : result.keep).push(modId);
  }
  return result;
}

/**
 * Of the old revision's dependency members (`candidates`), the ids of those that are optional
 * (recommends) and currently enabled in the profile - the set whose enabled state must be restored
 * after the collection is reinstalled.
 */
export function findEnabledOptionalMembers(
  candidates: IMod[],
  rules: IModRule[],
  modState: Record<string, IProfileMod> | undefined,
): string[] {
  const optionalRules = (rules ?? []).filter(isOptionalRule);
  return candidates
    .filter(
      (mod) =>
        findRuleByRef(optionalRules, mod) !== undefined && modState?.[mod.id]?.enabled === true,
    )
    .map((mod) => mod.id);
}
