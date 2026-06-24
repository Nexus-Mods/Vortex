import type { IModDetails } from "@/extensions/health_check/types";
import type { IExtensionApi } from "@/types/IExtensionContext";

/**
 * Fetch mod details for the given mod UIDs in a single batched modsByUid call,
 * mapping the Nexus response onto Vortex's IModDetails terms.
 *
 * Pass all UIDs at once: the underlying modsByUid call chunks them into batched
 * requests, so calling this per-UID would defeat the batching.
 */
export async function getModDetails(api: IExtensionApi, modUIDs: string[]): Promise<IModDetails[]> {
  if (modUIDs.length === 0) {
    return [];
  }

  const details = (await api.ext.nexusGetModDetailsByUid?.(modUIDs)) ?? [];

  return details.map((detail) => ({
    modUID: detail.uid,
    modName: detail.name ?? "",
    modSummary: detail.summary,
    thumbnailUrl: detail.thumbnailUrl,
    adultContent: detail.adultContent ?? false,
  }));
}
