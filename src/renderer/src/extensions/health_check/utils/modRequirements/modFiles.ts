import { setModFiles, setModFilesLoading } from "@/extensions/health_check/actions/session";
import { getModFiles as getModFilesSelector } from "@/extensions/health_check/selectors";
import type { IModDetails, IModFileInfo } from "@/extensions/health_check/types";
import { getModDetails } from "@/extensions/health_check/utils/shared/modDetails";
import { makeModUID } from "@/extensions/nexus_integration/util/UIDs";
import type { IExtensionApi } from "@/types/IExtensionContext";

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

  // Kick off the mod-details fetch (kept separate from the files call so its
  // IModDetails[] type isn't widened to any by the loosely-typed api.ext call),
  // then await both concurrently.
  const modUID = makeModUID({ gameId, modId: modId.toString(), fileId: "0" });
  const detailsPromise: Promise<IModDetails[]> = modUID
    ? getModDetails(api, [modUID])
    : Promise.resolve<IModDetails[]>([]);

  const modFiles = await api.ext.nexusGetModFiles?.(gameId, modId);
  if (!modFiles || modFiles.length === 0) {
    return [];
  }

  const details = await detailsPromise;
  const thumbnailUrl = details[0]?.thumbnailUrl;

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
      thumbnailUrl,
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
