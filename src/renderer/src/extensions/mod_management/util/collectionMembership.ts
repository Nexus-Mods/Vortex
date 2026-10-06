import type { IMod } from "../types/IMod";
import modName from "./modName";
import { findRuleByRef, isDependencyRule } from "./testModReference";

/**
 * Maps each of `modIds` that belongs to at least one installed collection to the names of those
 * collections. Mods outside every collection, and collection mods themselves, are left out.
 *
 * Membership is a collection rule matching the mod, the same test the collection code uses to
 * attribute an installed mod to its collection.
 */
export function collectionNamesByMod(
  mods: { [modId: string]: IMod },
  modIds: string[],
): { [modId: string]: string[] } {
  const collections = Object.values(mods).filter((mod) => mod.type === "collection");
  if (collections.length === 0) {
    return {};
  }

  const memberRules = collections.map((collection) => ({
    name: modName(collection),
    rules: (collection.rules ?? []).filter(isDependencyRule),
  }));

  return modIds.reduce<{ [modId: string]: string[] }>((result, modId) => {
    const mod = mods[modId];
    if (mod === undefined || mod.type === "collection") {
      return result;
    }

    const names = memberRules
      .filter(({ rules }) => findRuleByRef(rules, mod) !== undefined)
      .map(({ name }) => name);

    if (names.length > 0) {
      result[modId] = Array.from(new Set(names));
    }
    return result;
  }, {});
}
