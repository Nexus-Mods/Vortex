import type { VortexGameId } from "@vortex/shared";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { activeGameId } from "@/util/selectors";

import type { IMod } from "../../types/IMod";
import { confirmCollectionModUpdate } from "../collection_update_warning/collectionUpdateWarning";

/** Updates a mod to its newest file, asking first if a collection has it, as that pins its version. */
export const updateMod = async (api: IExtensionApi, mod: IMod, gameId: VortexGameId) => {
  if (!(await confirmCollectionModUpdate(api, activeGameId(api.getState()), mod.id))) {
    return;
  }

  api.events.emit(
    "mod-update",
    gameId,
    mod.attributes?.modId,
    mod.attributes?.newestFileId,
    mod.attributes?.source,
  );
};
