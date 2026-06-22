import type * as Redux from "redux";

import * as actions from "../../../actions";
import type { IMod } from "../../../extensions/mod_management/types/IMod";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { ProcessCanceled } from "../../../util/CustomErrors";
import { getSafe, setSafe } from "../../../util/storeHelper";

function applyDefaultInstallMode(prev: { [attrId: string]: any }, mod: IMod) {
  if (prev?.installMode?.[mod.id] === undefined) {
    const { installerChoices } = mod?.attributes ?? {};
    if (installerChoices?.type === "fomod" && installerChoices?.options?.length > 0) {
      prev = setSafe(prev, ["installMode", mod.id], "choices");
    }
  }

  return prev;
}

function applyDefaultSource(prev: { [attrId: string]: any }, mod: IMod) {
  if (prev?.source?.[mod.id] === undefined) {
    if (mod?.attributes?.source === "website") {
      prev = setSafe(prev, ["source", mod.id], {
        type: "browse",
        url: mod?.attributes?.url,
      });
    }
  }

  return prev;
}

/**
 * updates collection attributes to set defaults for all attributes that have nothing set yet
 */
export function genDefaultsAction(
  api: IExtensionApi,
  collectionId: string,
  mods: IMod[],
  gameId: string,
): Redux.Action {
  if (mods.length === 0) {
    // No mods, no point in continuing.
    return undefined;
  }
  const state = api.getState();
  const collection = getSafe(state, ["persistent", "mods", gameId, collectionId], undefined);
  if (collection === undefined) {
    const error = new ProcessCanceled("Unable to find collection mod", {
      collectionId: collection.id,
    });
    api.showErrorNotification("Failed to ascertain default install mode", error);
    return undefined;
  }

  const attr = getSafe(collection.attributes, ["collection"], {});
  const resAttr = mods.reduce((prev, mod) => {
    prev = applyDefaultInstallMode(prev, mod);
    prev = applyDefaultSource(prev, mod);

    return prev;
  }, attr);

  return actions.setModAttribute(gameId, collection.id, "collection", resAttr);
}
