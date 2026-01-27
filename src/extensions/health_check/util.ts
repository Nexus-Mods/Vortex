import type { IExtensionApi } from "../../types/IExtensionContext";
import type { IGame } from "../../types/IGame";
import { getGame, toPromise } from "../../util/api";
import { nexusGameId } from "../nexus_integration/util/convertGameId";
import type { IModFileInfo, IModRequirementExt } from "./types";
import { setModFiles, setModFilesLoading } from "./actions/session";
import { getModFiles as getModFilesSelector } from "./selectors";

/**
 * Fetch available MAIN files for a mod from Nexus
 * Only returns main category files (category_id === 1), sorted by upload date (newest first)
 */
async function fetchModFilesFromApi(
  api: IExtensionApi,
  gameId: string,
  modId: number,
): Promise<IModFileInfo[]> {
  const [modInfo, modFiles] = await Promise.all([
    api.ext.nexusGetModInfo?.(gameId, modId),
    api.ext.nexusGetModFiles?.(gameId, modId),
  ]);
  if (!modFiles || modFiles.length === 0) {
    return [];
  }

  // Filter for MAIN category files only (category_id === 1)
  const mainFiles = modFiles.filter((f) => f.category_id === 1);

  return mainFiles
    .map((f) => ({
      fileId: f.file_id,
      modId,
      gameId,
      name: f.name,
      version: f.version,
      category: f.category_id,
      categoryName: f.category_name,
      description: f.description,
      size: f.size,
      uploadedTimestamp: f.uploaded_timestamp,
      isPrimary: f.is_primary,
      thumbnailUrl: modInfo?.picture_url,
    }))
    .sort((a, b) => {
      // Sort by upload date (newest first)
      return b.uploadedTimestamp - a.uploadedTimestamp;
    });
}

/**
 * Get mod files with caching
 * Checks cache first, fetches from API if needed, and stores in Redux
 */
export async function getModFilesWithCache(
  api: IExtensionApi,
  gameId: string,
  modId: number,
): Promise<IModFileInfo[]> {
  // Check if already cached
  const cached = getModFilesSelector(api.getState(), modId);
  if (cached) {
    return cached;
  }

  // Mark as loading
  api.store?.dispatch(setModFilesLoading(modId, true));

  try {
    // Fetch from API
    const files = await fetchModFilesFromApi(api, gameId, modId);

    // Store in cache
    api.store?.dispatch(setModFiles(modId, files));

    return files;
  } finally {
    // Mark as not loading
    api.store?.dispatch(setModFilesLoading(modId, false));
  }
}

/**
 * Download and install missing mod requirements from Nexus
 */
export async function onDownloadRequirement(
  api: IExtensionApi,
  mod: IModRequirementExt,
  file?: IModFileInfo,
): Promise<void> {
  const getFileIds = async (): Promise<IModFileInfo[]> => {
    if (file !== undefined) {
      return [file];
    }

    const modFiles: IModFileInfo[] = await getModFilesWithCache(
      api,
      mod.gameId,
      mod.modId,
    );

    if (modFiles.length === 0) {
      api.showErrorNotification(
        `Failed to download requirements for mod ID ${mod.modId}`,
        `No files found for mod ID ${mod.modId} on Nexus Mods.`,
      );
      return [];
    }

    // Find the most recent main file (category_id === 1)
    const mainFiles = modFiles.filter((f) => f.category === 1);
    const files = mainFiles.sort(
      (lhs, rhs) => rhs.uploadedTimestamp - lhs.uploadedTimestamp,
    );
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

  const dlId = await toPromise<string>((cb) =>
    api.events.emit(
      "start-download",
      [nxmUrl],
      { game: gameId, name: targetFile.name, fileId: targetFile.fileId, modId },
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
