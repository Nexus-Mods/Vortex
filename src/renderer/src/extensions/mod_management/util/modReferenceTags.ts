/**
 * Recording collection-rule tags on an installed mod. A mod can be a member of more than one
 * collection, so the tag set is append-only: `attributes.referenceTag` keeps the first tag stamped
 * (older Vortex versions read only that field) and `attributes.referenceTags` carries all of them.
 *
 * The read side lives with the rest of the identity matching (testModReference).
 */
import type { Action } from "redux";

import { setModAttribute } from "../actions/mods";
import type { IMod } from "../types/IMod";
import { modReferenceTags } from "./testModReference";

/**
 * Actions recording `tags` on the mod's tag set. Sets the legacy single field only when the mod
 * carries no tag yet. Empty when every tag is already recorded.
 *
 * All tags for one mod must go through a single call: the actions carry the whole array, so two
 * calls built from the same mod would each write only their own addition.
 */
export function appendModReferenceTagsActions(
  gameId: string,
  modId: string,
  mod: IMod | undefined,
  tags: readonly (string | undefined)[],
): Action[] {
  const recorded = modReferenceTags(mod);
  const added: string[] = [];
  for (const tag of tags) {
    if (tag !== undefined && !recorded.includes(tag) && !added.includes(tag)) {
      added.push(tag);
    }
  }
  if (added.length === 0) {
    return [];
  }
  const actions: Action[] = [
    setModAttribute(gameId, modId, "referenceTags", [...recorded, ...added]) as Action,
  ];
  if (mod?.attributes?.referenceTag === undefined) {
    actions.push(setModAttribute(gameId, modId, "referenceTag", added[0]) as Action);
  }
  return actions;
}
