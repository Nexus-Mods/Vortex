import type { IMod } from "../../types/IMod";
import { collectionNamesByMod } from "../collection_membership/collectionMembership";
import { askCollectionUpdate } from "../collection_update_prompt/collectionUpdatePrompt";

/**
 * Asks the user to confirm updating a mod that belongs to the given collections. Resolves true
 * only when they choose to update anyway.
 */
export async function confirmCollectionModUpdate(collectionNames: string[]): Promise<boolean> {
  return (await askCollectionUpdate({ kind: "single", collectionNames })) === "all";
}

/**
 * Narrows a batch update to what the user is happy to update. A batch with no collection mods
 * passes straight through. Otherwise the user chooses between updating everything, only the mods
 * outside collections, or nothing. Resolves with the ids to update, empty when they cancel.
 *
 * Collection revision updates never come through here: they run through the collection's own
 * install flow, which the curator controls.
 */
export async function selectModsToUpdate(
  mods: { [modId: string]: IMod },
  modIds: string[],
): Promise<string[]> {
  const memberships = collectionNamesByMod(mods, modIds);
  if (Object.keys(memberships).length === 0) {
    return modIds;
  }

  const nonCollectionModIds = modIds.filter((modId) => memberships[modId] === undefined);

  const choice = await askCollectionUpdate({
    kind: "batch",
    collectionNames: Array.from(new Set(Object.values(memberships).flat())),
    hasNonCollectionMods: nonCollectionModIds.length > 0,
  });

  switch (choice) {
    case "all":
      return modIds;
    case "non-collection":
      return nonCollectionModIds;
    default:
      return [];
  }
}
