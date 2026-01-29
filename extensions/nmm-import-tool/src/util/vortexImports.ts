import { IModEntry } from "../types/nmmEntries";

import Promise from "bluebird";
import { actions, types, util } from "vortex-api";

export function addMetaData(
  gameID: string,
  modEntries: IModEntry[],
  api: types.IExtensionApi,
) {
  Promise.map(modEntries, (modEntry) => {
    if (!!modEntry.categoryId) {
      api.store.dispatch(
        actions.setDownloadModInfo(
          modEntry.archiveId,
          "custom.category",
          modEntry.categoryId,
        ),
      );
    }

    if (!!modEntry.nexusId) {
      api.store.dispatch(
        actions.setDownloadModInfo(modEntry.archiveId, "source", "nexus"),
      );
      api.store.dispatch(
        actions.setDownloadModInfo(
          modEntry.archiveId,
          "nexus.ids.modId",
          modEntry.nexusId,
        ),
      );
      api.store.dispatch(
        actions.setDownloadModInfo(
          modEntry.archiveId,
          "nexus.ids.gameId",
          gameID,
        ),
      );

      if (!!modEntry.modVersion) {
        api.store.dispatch(
          actions.setDownloadModInfo(
            modEntry.archiveId,
            "version",
            modEntry.modVersion,
          ),
        );
      }
      api.store.dispatch(
        actions.setDownloadModInfo(modEntry.archiveId, "game", gameID),
      );
      api.store.dispatch(
        actions.setDownloadModInfo(
          modEntry.archiveId,
          "name",
          modEntry.modName,
        ),
      );
    } else {
      // NMM did not store a modId for this mod. This is a valid
      //  case when a mod has been manually added to NMM.
      //  We're going to try and retrieve the nexus id from the file name
      //  if possible.
      const match = modEntry.modFilename.match(/-([0-9]+)-/);
      if (match !== null) {
        api.store.dispatch(
          actions.setDownloadModInfo(modEntry.archiveId, "source", "nexus"),
        );
        api.store.dispatch(
          actions.setDownloadModInfo(
            modEntry.archiveId,
            "nexus.ids.modId",
            match[1],
          ),
        );
      }
    }
  });
}
