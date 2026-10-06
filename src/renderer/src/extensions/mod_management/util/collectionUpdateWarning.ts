import type { IConditionResult, IDialogContent } from "../../../types/IDialog";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IMod } from "../types/IMod";
import { collectionNamesByMod } from "./collectionMembership";

export const COLLECTION_UPDATE_DIALOG_ID = "collection-update-warning-dialog";
export const UPDATE_ANYWAY = "Update anyway";
export const UPDATE_ALL = "Update all";
export const UPDATE_NON_COLLECTION = "Update non-collection mods";
export const CANCEL = "Cancel";

const ACKNOWLEDGE_ID = "acknowledge_collection_risk";

const escapeMarkdown = (text: string): string => text.replace(/[\\`*_{}[\]()#+\-.!<>|~]/g, "\\$&");

const collectionList = (collectionNames: string[]): string =>
  collectionNames.map((name) => `**${escapeMarkdown(name.trim())}**`).join("\n\n");

/**
 * The action stays disabled until the box is ticked. The condition runs against the live dialog
 * content, so it sees the checkbox as the user left it.
 */
const requireAcknowledgement =
  (blockedAction: string) =>
  (content: IDialogContent): IConditionResult[] => {
    const acknowledged = content.checkboxes?.find((box) => box.id === ACKNOWLEDGE_ID)?.value;
    return acknowledged === true
      ? []
      : [
          {
            id: ACKNOWLEDGE_ID,
            actions: [blockedAction],
            errorText: "Confirm that you understand the risk to continue",
          },
        ];
  };

const acknowledgementDialog = (
  md: string,
  checkboxText: string,
  blockedAction: string,
): IDialogContent => ({
  md,
  checkboxes: [{ id: ACKNOWLEDGE_ID, value: false, text: checkboxText }],
  options: { order: ["md", "checkboxes"] },
  condition: requireAcknowledgement(blockedAction),
});

export const collectionModUpdateDialog = (collectionNames: string[]): IDialogContent =>
  acknowledgementDialog(
    "This mod is part of the following collections:\n\n" +
      `${collectionList(collectionNames)}\n\n` +
      "It uses a version selected by the collection curator. Updating it may cause the " +
      "collection to stop working as intended.",
    "I understand that updating this mod may break my collection.",
    UPDATE_ANYWAY,
  );

/**
 * Asks the user to confirm updating a mod that belongs to the given collections. Resolves true
 * only when they pick "Update anyway".
 */
export async function confirmCollectionModUpdate(
  api: IExtensionApi,
  collectionNames: string[],
): Promise<boolean> {
  const result = await api.showDialog(
    "question",
    "Update this mod?",
    collectionModUpdateDialog(collectionNames),
    [{ label: CANCEL }, { label: UPDATE_ANYWAY }],
    COLLECTION_UPDATE_DIALOG_ID,
  );
  return result.action === UPDATE_ANYWAY;
}

export const collectionModsUpdateAllDialog = (
  collectionNames: string[],
  hasNonCollectionMods: boolean,
): IDialogContent =>
  acknowledgementDialog(
    "Some of the mods you're updating are part of the following collections:\n\n" +
      `${collectionList(collectionNames)}\n\n` +
      "Updating them may cause these collections to stop working as intended." +
      (hasNonCollectionMods
        ? "\n\n**Recommended:** Update only mods that aren't part of a collection."
        : ""),
    "I understand that updating collection mods may break my collection.",
    UPDATE_ALL,
  );

/**
 * Narrows a batch update to what the user is happy to update. A batch with no collection mods
 * passes straight through. Otherwise the user chooses between updating everything, only the mods
 * outside collections, or nothing. Resolves with the ids to update, empty when they cancel.
 *
 * Collection revision updates never come through here: they run through the collection's own
 * install flow, which the curator controls.
 */
export async function selectModsToUpdate(
  api: IExtensionApi,
  mods: { [modId: string]: IMod },
  modIds: string[],
): Promise<string[]> {
  const memberships = collectionNamesByMod(mods, modIds);
  if (Object.keys(memberships).length === 0) {
    return modIds;
  }

  const collectionNames = Array.from(new Set(Object.values(memberships).flat()));
  const nonCollectionModIds = modIds.filter((modId) => memberships[modId] === undefined);
  const hasNonCollectionMods = nonCollectionModIds.length > 0;

  const result = await api.showDialog(
    "question",
    "Some mods are part of a collection",
    collectionModsUpdateAllDialog(collectionNames, hasNonCollectionMods),
    [
      { label: CANCEL },
      { label: UPDATE_ALL },
      ...(hasNonCollectionMods ? [{ label: UPDATE_NON_COLLECTION, default: true }] : []),
    ],
    COLLECTION_UPDATE_DIALOG_ID,
  );

  switch (result.action) {
    case UPDATE_ALL:
      return modIds;
    case UPDATE_NON_COLLECTION:
      return nonCollectionModIds;
    default:
      return [];
  }
}
