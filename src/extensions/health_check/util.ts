import type { IExtensionApi } from "../../types/IExtensionContext";
import type { IGame } from "../../types/IGame";
import { getGame, toPromise } from "../../util/api";
import { nexusGameId } from "../nexus_integration/util/convertGameId";

interface IModFile {
  category_id: number;
  uploaded_time: string;
  name: string;
  file_id: number;
}

/**
 * Download and install missing mod requirements from Nexus
 */
export async function onDownloadRequirements(
  api: IExtensionApi,
  gameId: string,
  modIds: number[],
): Promise<void> {
  await Promise.all(
    modIds.map(async (modId: number) => {
      const modFiles: IModFile[] | undefined = await api.ext.nexusGetModFiles(
        gameId,
        modId,
      );
      if (modFiles === undefined || modFiles.length === 0) {
        api.showErrorNotification(
          `Failed to download requirements for mod ID ${modId}`,
          `No files found for mod ID ${modId} on Nexus Mods.`,
        );
        return;
      }

      // Find the most recent main file (category_id === 1)
      const mainFiles = modFiles.filter((f) => f.category_id === 1);
      const file = mainFiles.sort(
        (lhs, rhs) =>
          Number.parseInt(rhs.uploaded_time, 10) -
          Number.parseInt(lhs.uploaded_time, 10),
      )[0];

      if (file === undefined) {
        api.showErrorNotification(
          `Failed to download requirements for mod ID ${modId}`,
          `No main file found for mod ID ${modId} on Nexus Mods.`,
        );
        return;
      }

      const game: IGame = getGame(gameId);
      const nexusDomainName = nexusGameId(game, gameId);
      const nxmUrl = `nxm://${nexusDomainName}/mods/${modId}/files/${file.file_id}`;

      const dlId = await toPromise<string>((cb) =>
        api.events.emit(
          "start-download",
          [nxmUrl],
          { game: gameId, name: file.name, fileId: file.file_id, modId },
          undefined,
          cb,
          undefined,
          { allowInstall: false },
        ),
      );

      await toPromise<string>((cb) =>
        api.events.emit(
          "start-install-download",
          dlId,
          { allowAutoEnable: false },
          cb,
        ),
      );
    }),
  );

  api.sendNotification({
    type: "info",
    message: "Nexus Mod Requirements download finished",
    displayMS: 5000,
    id: "health-check:nexus-requirements-download-finished",
  });
}
