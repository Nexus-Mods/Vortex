import type { IMod } from "@/extensions/mod_management/types/IMod";
import {
  isDependencyRule,
  modReferenceTags,
} from "@/extensions/mod_management/util/testModReference";
import type { IProfile } from "@/extensions/profile_management/types/IProfile";

/**
 * Reference tags of mods pulled in by a collection installed on the active profile,
 * via either a required or optional/recommended rule. A mod carrying one of these
 * tags is collection-managed: it satisfies other mods' requirements but should not
 * have its own emitted (the collection already vetted it).
 * Edit `countsForProfile` to change which collections count.
 */
export function collectionManagedTags(
  mods: { [modId: string]: IMod },
  profile: IProfile,
): Set<string> {
  const countsForProfile = (collection: IMod): boolean => profile.modState?.[collection.id] != null;

  const tags = new Set<string>();
  for (const mod of Object.values(mods)) {
    if (mod.type !== "collection" || !countsForProfile(mod)) {
      continue;
    }
    for (const rule of mod.rules ?? []) {
      if (isDependencyRule(rule) && rule.reference?.tag != null) {
        tags.add(rule.reference.tag);
      }
    }
  }
  return tags;
}

/**
 * Whether any tag the mod carries is one of the given collection-managed tags. A mod can belong
 * to several collections, each recording its own tag, so all of them count - reading only the
 * first-stamped `referenceTag` would drop the mod from every collection but that one.
 */
export function isCollectionManaged(mod: IMod, collectionTags: Set<string>): boolean {
  return modReferenceTags(mod).some((tag) => collectionTags.has(tag));
}
