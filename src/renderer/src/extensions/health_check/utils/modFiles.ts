import type { IExtensionApi } from "@/types/IExtensionContext";

import { setModFiles, setModFilesLoading } from "../actions/session";
import { getModFiles as getModFilesSelector } from "../selectors";
import type { IModFileInfo } from "../types";

/**
 * Fetch available MAIN files for a mod from Nexus
 * Only returns main category files (category_id === 1), sorted by upload date (newest first)
 */
async function fetchModFilesFromApi(
  api: IExtensionApi,
  gameId: string,
  modId: number,
): Promise<IModFileInfo[]> {
  if (!Number.isInteger(modId) || modId <= 0 || !gameId) {
    return [];
  }

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
