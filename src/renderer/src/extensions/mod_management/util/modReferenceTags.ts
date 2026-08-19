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
 * Actions recording `tag` on the mod's tag set. Sets the legacy single field only when the mod
 * carries no tag yet. Empty when the tag is already recorded or the rule has none.
 */
export function appendModReferenceTagActions(
  gameId: string,
  modId: string,
  mod: IMod | undefined,
  tag: string | undefined,
): Action[] {
  if (tag === undefined) {
    return [];
  }
  const tags = modReferenceTags(mod);
  if (tags.includes(tag)) {
    return [];
  }
  const actions: Action[] = [
    setModAttribute(gameId, modId, "referenceTags", [...tags, tag]) as Action,
  ];
  if (mod?.attributes?.referenceTag === undefined) {
    actions.push(setModAttribute(gameId, modId, "referenceTag", tag) as Action);
  }
  return actions;
}
