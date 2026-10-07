import { modRuleId } from "../../../util/collectionInstallSession";
import { setdefault } from "../../../util/util";
import type { IMod } from "../../mod_management/types/IMod";
import { findModByRef } from "../../mod_management/util/findModByRef";
import { isDependencyRule } from "../../mod_management/util/testModReference";
import { MOD_TYPE } from "../constants";
import {
  type CollectionModsResolver,
  resolveCollectionMods,
} from "./resolveCollectionMods/resolveCollectionMods";

/**
 * The installed collections each mod belongs to, by mod id, from the collections' rules. Pass a
 * resolver from makeCollectionModsResolver when this reruns as mods change, so each run only
 * retests the mods that changed.
 */
export function collectionsByMod(
  mods: { [modId: string]: IMod },
  resolve: CollectionModsResolver = (rules, all) => resolveCollectionMods(rules ?? [], all),
): {
  [modId: string]: IMod[];
} {
  const collections = Object.values(mods).filter((mod) => mod.type === MOD_TYPE);

  const result: { [modId: string]: IMod[] } = {};

  collections.forEach((coll) => {
    const resolved = resolve(coll.rules, mods);
    (coll.rules ?? []).forEach((rule) => {
      if (rule.reference.id !== undefined) {
        setdefault(result, rule.reference.id, []).push(coll);
      } else {
        const installed = isDependencyRule(rule)
          ? resolved.byRule.get(modRuleId(rule))
          : findModByRef(rule.reference, mods);
        if (installed !== undefined) {
          setdefault(result, installed.id, []).push(coll);
        }
      }
    });
  });

  return result;
}
