import type { IMod, IModRule } from "../../mod_management/types/IMod";
import { findModByRef } from "../../mod_management/util/findModByRef";
import { findRuleByRef, isDependencyRule } from "../../mod_management/util/testModReference";

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
