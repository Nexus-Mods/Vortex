import * as path from "path";

import { unknownToError } from "@vortex/shared";

import type { IExtensionApi } from "@/types/IExtensionContext";
import * as selectors from "@/util/selectors";

import renderModName from "../../../mod_management/util/modName";
import { MOD_TYPE } from "../../constants";
import { postprocessCollection } from "../../postprocessCollection";
import type { ICollection } from "../../types/ICollection";
import { readCollection } from "../readCollection";

/** Applies a collection's rules again, from its installed collection.json; reports its own failures. */
export const applyCollectionRules = async (api: IExtensionApi, modId: string): Promise<void> => {
  const state = api.getState();
  const gameId = selectors.activeGameId(state);
  const mods = state.persistent.mods[gameId];
  const mod = mods?.[modId];

  if (mod?.type !== MOD_TYPE) {
    return;
  }

  const stagingPath = selectors.installPathForGame(state, gameId);

  let collectionInfo: ICollection;
  try {
    collectionInfo = await readCollection(
      api,
      path.join(stagingPath, mod.installationPath, "collection.json"),
    );
  } catch (err) {
    api.showErrorNotification("Failed to read collection info", unknownToError(err), {
      message: renderModName(mod),
    });
    return;
  }

  try {
    await postprocessCollection(api, gameId, mod, collectionInfo, mods);
  } catch (err) {
    api.showErrorNotification("Failed to apply collection rules", unknownToError(err), {
      message: renderModName(mod),
    });
  }
};
