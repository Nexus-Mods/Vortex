import type { IModDetails, IModFileInfo } from "@/extensions/health_check/types";
import {
  createKeyedCache,
  type KeyedCache,
} from "@/extensions/health_check/utils/shared/batchCache";
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
  const modDetail = details[0];

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
      thumbnailUrl: modDetail?.thumbnailUrl,
      adultContent: modDetail?.adultContent ?? false,
      modSummary: modDetail?.modSummary,
    }))
    .sort((a, b) => {
      // Sort by upload date (newest first)
      return b.uploadedTimestamp - a.uploadedTimestamp;
    });
}

// Mod file lists rarely change between runs; cache in memory with a TTL so re-runs
// refetch at most once per TTL. Mirrors the mod-requirements and mod-details caches.
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

// Keyed by game + mod id so the same mod id across games does not collide.
const modFilesCache: KeyedCache<IModFileInfo[]> = createKeyedCache(CACHE_TTL_MS);

/**
 * Get a mod's main files, cached in memory with a TTL. Fetches from the API only
 * on a cache miss.
 */
export async function getModFilesWithCache(
  api: IExtensionApi,
  gameId: string,
  modId: number,
): Promise<IModFileInfo[]> {
  const cacheKey = `${gameId}:${modId}`;
  const cached = modFilesCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const files = await fetchModFilesFromApi(api, gameId, modId);
  modFilesCache.set(cacheKey, files);
  return files;
}
