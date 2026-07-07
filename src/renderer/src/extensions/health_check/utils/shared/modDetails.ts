import type { components } from "@vortex/nexus-api-v3";

import type { IModDetails } from "@/extensions/health_check/types";
import { createVortexNexusV3Client } from "@/extensions/nexus_integration/nexusV3Client";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { chunked, createKeyedCache, resolveCached, type KeyedCache } from "./batchCache";

type V3Client = ReturnType<typeof createVortexNexusV3Client>;
type V3ModDetail = components["schemas"]["ModDetail"];

// /mods/batch resolves up to 2000 ids per call.
const MAX_MOD_IDS = 2000;
// Mod display details rarely change between runs; cache for a while.
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

const modDetailCache: KeyedCache<IModDetails> = createKeyedCache(CACHE_TTL_MS);

function toModDetails(row: V3ModDetail): IModDetails {
  return {
    modUID: row.id,
    modName: row.name,
    modSummary: row.summary,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    adultContent: row.adult_content,
  };
}

/** Read mod display details for the given mods, across id chunks. */
async function fetchModDetailRows(client: V3Client, modUIDs: string[]): Promise<V3ModDetail[]> {
  const pages: V3ModDetail[][] = [];
  for (const ids of chunked(modUIDs, MAX_MOD_IDS)) {
    pages.push(await client.getModsBatch(ids));
  }
  return pages.flat();
}

/**
 * Fetch mod-level display details for the given mod UIDs via the Nexus v3
 * /mods/batch endpoint, chunked to the per-request id limit and cached by uid
 * so re-runs only fetch the misses. Shared by the mod- and file-level checks.
 */
export async function getModDetails(api: IExtensionApi, modUIDs: string[]): Promise<IModDetails[]> {
  if (modUIDs.length === 0) {
    return [];
  }

  const client = createVortexNexusV3Client(api);
  const byUid = await resolveCached(modUIDs, modDetailCache, async (missing) => {
    const details = (await fetchModDetailRows(client, missing)).map(toModDetails);
    return new Map(details.map((detail) => [detail.modUID, detail]));
  });
  return [...byUid.values()];
}
