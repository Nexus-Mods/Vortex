import type { IExtensionApi } from "../../../../types/IExtensionContext";
import {
  collectionNamesByMod,
  ignorePinnedCollectionRules,
} from "../collection_membership/collectionMembership";
import { askCollectionUpdate } from "../collection_update_prompt/collectionUpdatePrompt";

const gameMods = (api: IExtensionApi, gameId: string) =>
  api.getState().persistent.mods[gameId] ?? {};

/**
 * Asks the user to confirm updating a mod that belongs to collections. Resolves true when it
 * belongs to none, or when they choose to update anyway, which ignores the collections' pins on
 * its version.
 */
export async function confirmCollectionModUpdate(
  api: IExtensionApi,
  gameId: string,
  modId: string,
): Promise<boolean> {
  const collectionNames = collectionNamesByMod(gameMods(api, gameId), [modId])[modId];
  if (collectionNames === undefined) {
    return true;
  }

  const confirmed = (await askCollectionUpdate({ kind: "single", collectionNames })) === "all";
  if (confirmed) {
    ignorePinnedCollectionRules(api, gameId, [modId]);
  }
  return confirmed;
}

/**
 * Narrows a batch update to what the user is happy to update. A batch with no collection mods
 * passes straight through. Otherwise the user chooses between updating everything, only the mods
 * outside collections, or nothing. Resolves with the ids to update, empty when they cancel.
 * Choosing everything ignores the collections' pins on the versions of the mods they contain.
 *
 * Collection revision updates never come through here: they run through the collection's own
 * install flow, which the curator controls.
 */
export async function selectModsToUpdate(
  api: IExtensionApi,
  gameId: string,
  modIds: string[],
): Promise<string[]> {
  const memberships = collectionNamesByMod(gameMods(api, gameId), modIds);
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
      ignorePinnedCollectionRules(api, gameId, Object.keys(memberships));
      return modIds;
    case "non-collection":
      return nonCollectionModIds;
    default:
      return [];
  }
}
