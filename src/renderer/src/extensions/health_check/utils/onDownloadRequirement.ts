import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IGame } from "@/types/IGame";
import { getGame, toPromise } from "@/util/api";

import { knownGames } from "../../gamemode_management/selectors";
import { convertGameIdReverse, nexusGameId } from "../../nexus_integration/util/convertGameId";
import type { IModFileInfo, IModRequirementExt } from "../types";
import { getModFilesWithCache } from "./modFiles";

/**
 * Download and install missing mod requirements from Nexus
 */
export async function onDownloadRequirement(
  api: IExtensionApi,
  mod: IModRequirementExt,
  file?: IModFileInfo,
): Promise<void> {
  if (!Number.isInteger(mod.modId) || mod.modId <= 0) {
    api.showErrorNotification(
      `Cannot download requirement "${mod.modName}"`,
      "This requirement does not have a valid Nexus Mods ID.",
      { allowReport: false },
    );
    return;
  }

  const getFileIds = async (): Promise<IModFileInfo[]> => {
    if (file !== undefined) {
      return [file];
    }

    const modFiles: IModFileInfo[] = await getModFilesWithCache(api, mod.gameId, mod.modId);

    if (modFiles.length === 0) {
      api.showErrorNotification(
        `Failed to download requirements for mod ID ${mod.modId}`,
        `No files found for mod ID ${mod.modId} on Nexus Mods.`,
      );
      return [];
    }

    // Find the most recent main file (category_id === 1)
    const mainFiles = modFiles.filter((f) => f.category === 1);
    const files = mainFiles.sort((lhs, rhs) => rhs.uploadedTimestamp - lhs.uploadedTimestamp);
    return files;
  };

  const fileIds = await getFileIds();
  if (fileIds.length === 0) {
    return;
  }

  const gameId = mod.gameId;
  const modId = mod.modId;
  const targetFile = fileIds[0];

  const game: IGame = getGame(gameId);
  const nexusDomainName = nexusGameId(game, gameId);
  const nxmUrl = `nxm://${nexusDomainName}/mods/${modId}/files/${targetFile.fileId}`;
  // mod.gameId is the Nexus domain (e.g. "skyrimspecialedition"); the downloader and
  // download.game records key on the internal id ("skyrimse"). Convert before emitting
  // so the file lands in the same folder the install handler later looks in.
  const internalGameId = convertGameIdReverse(knownGames(api.getState()), gameId) || gameId;

  const dlId = await toPromise<string>((cb) =>
    api.events.emit(
      "start-download",
      [nxmUrl],
      { game: internalGameId, name: targetFile.name, fileId: targetFile.fileId, modId },
      undefined,
      cb,
      undefined,
      { allowInstall: false },
    ),
  );

  const installedModId = await toPromise<string>((cb) =>
    api.events.emit(
      "start-install-download",
      dlId,
      { allowAutoEnable: true }, // Auto-enable since user explicitly requested via requirements
      cb,
    ),
  );

  api.sendNotification({
    type: "success",
    message: `Requirement installed and enabled: ${mod.modName}`,
    displayMS: 5000,
    id: "health-check:nexus-requirements-download-finished",
  });
}
