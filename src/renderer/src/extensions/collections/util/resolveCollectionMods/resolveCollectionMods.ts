import { modRuleId } from "../../../../util/collectionInstallSession";
import type { IMod, IModRule } from "../../../mod_management/types/IMod";
import { findModByRef } from "../../../mod_management/util/findModByRef";
import { isDependencyRule, modReferenceTags } from "../../../mod_management/util/testModReference";

/** each dependency rule's installed mod, and the inputs it was resolved from */
export interface ResolvedMods {
  rules: IModRule[];
  // keyed by mod id
  mods: Record<string, IMod>;
  // keyed by rule id; a rule with no installed mod is absent
  byRule: Map<string, IMod>;
}

/**
 * Resolve each of a collection's dependency rules to its installed mod. This depends only on the
 * rules and the installed mods, so callers memoize it on those: download progress changes neither.
 *
 * Pass the prior result as `previous` to make the findModByRef fallback incremental. That fallback
 * scans every installed mod for each member the indexes miss - on a large collection, every member
 * not yet installed - and mods change several times a second while a collection installs. The
 * match is pure, so a mod that did not match a member before and is unchanged still does not:
 * a member left unresolved is retested only against the mods added or changed since.
 */
export function resolveCollectionMods(
  rules: IModRule[],
  // keyed by mod id
  mods: Record<string, IMod>,
  previous?: ResolvedMods,
): ResolvedMods {
  if (previous?.rules === rules && previous.mods === mods) {
    return previous;
  }

  // Built once so each rule resolves in O(1) instead of scanning every mod. Installed mods are
  // keyed by every reference tag they satisfy and by content hash (fileMD5). First entry wins on
  // the (rare) duplicate, matching findModByRef's first-match.
  const modByTag = new Map<string, IMod>();
  const modByMd5 = new Map<string, IMod>();
  for (const mod of Object.values(mods)) {
    for (const tag of modReferenceTags(mod)) {
      if (!modByTag.has(tag)) {
        modByTag.set(tag, mod);
      }
    }
    const md5 = mod.attributes?.fileMD5;
    if (typeof md5 === "string" && !modByMd5.has(md5)) {
      modByMd5.set(md5, mod);
    }
  }

  // the prior result only carries over for the same rules; the mods added or changed since are
  // the only ones that can newly match a member it left unresolved (keyed by mod id)
  const prior = previous?.rules === rules ? previous : undefined;
  let changedMods: Record<string, IMod> | undefined;
  if (prior !== undefined) {
    changedMods = {};
    for (const [modId, mod] of Object.entries(mods)) {
      if (prior.mods[modId] !== mod) {
        changedMods[modId] = mod;
      }
    }
  }

  const byRule = new Map<string, IMod>();
  for (const rule of (rules ?? []).filter(isDependencyRule)) {
    const id = modRuleId(rule);
    // Match priority mirrors testModReference's exact-identity markers. A collection member's
    // installed mod carries the rule's referenceTag (authoritative), and is also keyed by content
    // hash so a member whose tag drifted, or that was matched by hash rather than tag, is still
    // recognised - a hash match is the same file, so there are no false positives.
    const { tag, fileMD5 } = rule.reference;
    let mod = tag !== undefined ? modByTag.get(tag) : undefined;
    if (mod === undefined && fileMD5 !== undefined) {
      mod = modByMd5.get(fileMD5);
    }
    // Neither index resolved the mod (e.g. a fuzzy/latest member whose tag drifted across
    // collections and has no fileMD5). Fall back to findModByRef - the same identity match
    // reconstructSessionMods uses - so the table agrees with the session rather than showing an
    // installed member as "pending".
    if (mod === undefined) {
      const priorMod = prior?.byRule.get(id);
      if (prior === undefined) {
        mod = findModByRef(rule.reference, mods);
      } else if (priorMod === undefined) {
        mod = findModByRef(rule.reference, changedMods);
      } else if (mods[priorMod.id] === priorMod) {
        mod = priorMod;
      } else {
        // the mod it matched was changed or removed, so it may no longer match
        mod = findModByRef(rule.reference, mods);
      }
    }
    if (mod !== undefined) {
      byRule.set(id, mod);
    }
  }
  return { rules, mods, byRule };
}

/** resolveCollectionMods for any collection, remembering each one's last result */
export type CollectionModsResolver = (
  rules: IModRule[] | undefined,
  // keyed by mod id
  mods: Record<string, IMod>,
) => ResolvedMods;

const NO_RULES: IModRule[] = [];

/**
 * A resolver that threads each collection's last result back in, so a re-resolve only retests the
 * mods that changed. Keep one per source of mods: a prior result only saves work against the same
 * mod objects, and the Mods page's merged mod-with-state objects are not the persistent ones.
 */
export function makeCollectionModsResolver(): CollectionModsResolver {
  // keyed by the collection's rules array, which a collection keeps until its rules change
  const last = new WeakMap<IModRule[], ResolvedMods>();
  return (rules, mods) => {
    const key = rules ?? NO_RULES;
    const resolved = resolveCollectionMods(key, mods, last.get(key));
    last.set(key, resolved);
    return resolved;
  };
}
