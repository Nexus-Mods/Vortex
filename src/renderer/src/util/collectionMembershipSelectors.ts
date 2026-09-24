import { createSelector } from "reselect";

import { MOD_TYPE } from "../extensions/collections/constants";
import { modsForActiveGame } from "../extensions/mod_management/selectors";
import type { ICollectionAttributes, IMod } from "../extensions/mod_management/types/IMod";
import {
  isDependencyRule,
  modReferenceTags,
} from "../extensions/mod_management/util/testModReference";
import { activeProfile } from "../extensions/profile_management/selectors";
import type { IProfile } from "../extensions/profile_management/types/IProfile";

/** The published collection a mod came from, named as the rest of the codebase names it. */
export type ICollectionSource = Pick<ICollectionAttributes, "collectionSlug" | "revisionNumber">;

export interface ICollectionIndex {
  /** The collections enabled on the profile. */
  enabled: ICollectionSource[];
  /** The collection a mod was installed from, enabled or not. */
  sourceOf: (modId: string | undefined) => ICollectionSource | undefined;
}

function sourceOfCollection(mod: IMod | undefined): ICollectionSource | undefined {
  const { collectionSlug, revisionNumber } = mod?.attributes ?? {};
  return collectionSlug !== undefined && revisionNumber !== undefined
    ? { collectionSlug, revisionNumber }
    : undefined;
}

/**
 * Resolves which collection each mod came from. A mod only carries the collection's own attributes
 * when a recent Vortex installed it, so the fallback is the collections' membership rules: every
 * member is stamped with the reference tag of the rule that pulled it in. Indexing those tags keeps
 * a lookup to one map hit, where matching each rule against every mod is quadratic.
 */
export function makeCollectionIndex(
  // keyed by mod id
  mods: Record<string, IMod>,
  profile: IProfile | undefined,
): ICollectionIndex {
  const enabled: ICollectionSource[] = [];
  // a member's reference tag -> the collection whose rule stamped it
  const byTag = new Map<string, ICollectionSource>();

  for (const mod of Object.values(mods)) {
    const source = mod.type === MOD_TYPE ? sourceOfCollection(mod) : undefined;
    if (source === undefined) {
      continue;
    }
    if (profile?.modState?.[mod.id]?.enabled === true) {
      enabled.push(source);
    }
    for (const rule of mod.rules ?? []) {
      const tag = rule.reference.tag;
      if (tag !== undefined && isDependencyRule(rule) && !byTag.has(tag)) {
        byTag.set(tag, source);
      }
    }
  }

  return {
    enabled,
    sourceOf: (modId) => {
      const mod = modId === undefined || modId === "" ? undefined : mods[modId];
      if (mod === undefined) {
        return undefined;
      }
      // a mod can belong to several collections; the first tag that resolves names one of them
      return (
        sourceOfCollection(mod) ??
        modReferenceTags(mod)
          .map((tag) => byTag.get(tag))
          .find((source) => source !== undefined)
      );
    },
  };
}

/** The collection index for the active game and profile, rebuilt only when either changes. */
export const activeCollectionIndex = createSelector(
  [modsForActiveGame, activeProfile],
  makeCollectionIndex,
);

/** A collection in one span attribute, the way its Nexus URL reads. */
export const formatCollectionSource = (source: ICollectionSource): string =>
  `${source.collectionSlug}@${source.revisionNumber}`;
