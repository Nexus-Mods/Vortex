import { CACHE_EXPIRE_MS, CACHE_LRU_COUNT } from "../constants";

interface ICacheEntry {
  timestamp: number;
}

function pickEvictions(
  entries: Record<string, ICacheEntry>,
  cutOffTime: number,
  lruCount: number,
): string[] {
  return Object.keys(entries)
    .sort((lhs, rhs) => entries[rhs].timestamp - entries[lhs].timestamp)
    .reduce<string[]>((prev, key, idx) => {
      if (idx >= lruCount || entries[key].timestamp < cutOffTime) {
        prev.push(key);
      }
      return prev;
    }, []);
}

/**
 * Pure core of InfoCache.clearCache: given the current cache state and a clock
 * value, returns the ids of cache entries that should be dropped.
 *
 * - Entries older than `expireMs` are always dropped.
 * - Beyond `lruCount` newest entries, the oldest are dropped.
 */
export function computeCacheEvictions(
  cache: {
    collections: Record<string, ICacheEntry>;
    revisions: Record<string, ICacheEntry>;
  },
  now: number,
  expireMs: number = CACHE_EXPIRE_MS,
  lruCount: number = CACHE_LRU_COUNT,
): { collectionDrops: string[]; revisionDrops: string[] } {
  const cutOffTime = now - expireMs;
  return {
    collectionDrops: pickEvictions(cache.collections, cutOffTime, lruCount),
    revisionDrops: pickEvictions(cache.revisions, cutOffTime, lruCount),
  };
}
