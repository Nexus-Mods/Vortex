/**
 * Helper functions extracted from InstallManager.ts for better modularity.
 * These are pure functions with no side effects, making them easy to test.
 */
import type { IModRule } from "../types/IMod";
import { findDownloadByRef } from "../util/dependencies";

/**
 * Reference type that can be used to look up downloads.
 * Supports both tag-based and MD5-based lookups.
 */
interface IDownloadReference {
  tag?: string;
  md5Hint?: string;
  [key: string]: any; // Allow other properties from IReference
}

/**
 * Find a download by its reference tag or MD5 hint.
 * Checks both the standard download lookup and fallback tag/MD5 matching.
 */
export function findDownloadByReferenceTag(
  downloads: { [downloadId: string]: any },
  reference: IDownloadReference | null | undefined,
): string | null {
  // findDownloadByRef expects IReference from modmeta-db, cast to any for compatibility
  const dlId = findDownloadByRef(reference as any, downloads);
  if (dlId) {
    return dlId;
  }

  if (!reference?.tag) {
    return null;
  }

  return (
    Object.keys(downloads).find(
      (id) =>
        downloads[id].modInfo?.referenceTag === reference.tag ||
        (reference.md5Hint && downloads[id].fileMD5 === reference.md5Hint),
    ) || null
  );
}

/**
 * Get a download ID that is ready for installation.
 * Returns null if the download is not finished or already being installed.
 */
export function getReadyDownloadId(
  downloads: { [downloadId: string]: any },
  reference: { tag?: string; md5Hint?: string },
  hasActiveOrPendingCheck: (downloadId: string) => boolean,
): string | null {
  const downloadId = findDownloadByReferenceTag(downloads, reference);

  if (!downloadId) {
    return null;
  }

  const download = downloads[downloadId];
  if (download.state === "finished" && !hasActiveOrPendingCheck(downloadId)) {
    return downloadId;
  }

  return null;
}

/**
 * Filter mods to only include those belonging to a specific phase.
 */
export function getModsByPhase(allMods: any[], phase: number): any[] {
  return allMods.filter((mod: any) => (mod.phase ?? 0) === phase);
}

/**
 * Filter rules to only include non-ignored requires/recommends rules.
 * Used for dependency resolution.
 */
export function filterDependencyRules(rules: IModRule[]): IModRule[] {
  return (rules ?? []).filter(
    (rule: IModRule) =>
      ["recommends", "requires"].includes(rule.type) && !rule.ignored,
  );
}
