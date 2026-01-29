import * as Redux from "redux";
import { actions, types, util } from "vortex-api";

function applyDefaultInstallMode(
  prev: { [attrId: string]: any },
  mod: types.IMod,
) {
  if (prev?.installMode?.[mod.id] === undefined) {
    const { installerChoices } = mod?.attributes ?? {};
    if (
      installerChoices?.type === "fomod" &&
      installerChoices?.options?.length > 0
    ) {
      prev = util.setSafe(prev, ["installMode", mod.id], "choices");
    }
  }

  return prev;
}

function applyDefaultSource(prev: { [attrId: string]: any }, mod: types.IMod) {
  if (prev?.source?.[mod.id] === undefined) {
    if (mod?.attributes?.source === "website") {
      prev = util.setSafe(prev, ["source", mod.id], {
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
  api: types.IExtensionApi,
  collectionId: string,
  mods: types.IMod[],
  gameId: string,
): Redux.Action {
  if (mods.length === 0) {
    // No mods, no point in continuing.
    return undefined;
  }
  const state = api.getState();
  const collection = util.getSafe(
    state,
    ["persistent", "mods", gameId, collectionId],
    undefined,
  );
  if (collection === undefined) {
    const error = new util.ProcessCanceled("Unable to find collection mod", {
      collectionId: collection.id,
    });
    api.showErrorNotification(
      "Failed to ascertain default install mode",
      error,
    );
    return undefined;
  }

  const attr = util.getSafe(collection.attributes, ["collection"], {});
  const resAttr = mods.reduce((prev, mod) => {
    prev = applyDefaultInstallMode(prev, mod);
    prev = applyDefaultSource(prev, mod);

    return prev;
  }, attr);

  return actions.setModAttribute(gameId, collection.id, "collection", resAttr);
}
