import { describe, expect, it } from "vitest";

import { computeCacheEvictions } from "./cacheEvictions";
import { CACHE_EXPIRE_MS, CACHE_LRU_COUNT } from "../constants";

// ---------------------------------------------------------------------------
// computeCacheEvictions
// ---------------------------------------------------------------------------

describe("computeCacheEvictions", () => {
  it("returns empty drops when caches are empty", () => {
    const result = computeCacheEvictions(
      { collections: {}, revisions: {} },
      Date.now(),
    );

    expect(result.collectionDrops).toEqual([]);
    expect(result.revisionDrops).toEqual([]);
  });

  it("drops collections older than CACHE_EXPIRE_MS", () => {
    const now = 2_000_000_000;

    const collections = {
      fresh: { timestamp: now - 1000 },
      expired: { timestamp: now - CACHE_EXPIRE_MS - 1 },
    };

    const result = computeCacheEvictions(
      { collections, revisions: {} },
      now,
    );

    expect(result.collectionDrops).toContain("expired");
    expect(result.collectionDrops).not.toContain("fresh");
  });

  it("drops revisions older than CACHE_EXPIRE_MS", () => {
    const now = 2_000_000_000;

    const revisions = {
      10: { timestamp: now - 1000 },
      20: { timestamp: now - CACHE_EXPIRE_MS - 1 },
    };

    const result = computeCacheEvictions(
      { collections: {}, revisions },
      now,
    );

    // Object.keys returns strings, so revisionId comes through as a string
    expect(result.revisionDrops).toContain("20");
    expect(result.revisionDrops).not.toContain("10");
  });

  it("enforces LRU limit by dropping oldest entries beyond CACHE_LRU_COUNT", () => {
    const now = 2_000_000_000;

    // Create CACHE_LRU_COUNT + 5 entries, all within the expire window
    const collections: Record<string, { timestamp: number }> = {};
    for (let i = 0; i < CACHE_LRU_COUNT + 5; i++) {
      // Newer entries get higher timestamps
      collections[`col-${i}`] = {
        timestamp: now - (CACHE_LRU_COUNT + 5 - i) * 1000,
      };
    }

    const result = computeCacheEvictions(
      { collections, revisions: {} },
      now,
    );

    // Should drop at least the 5 that exceed the LRU count
    expect(result.collectionDrops.length).toBeGreaterThanOrEqual(5);
  });

  it("keeps all entries when count is at the LRU limit and none are expired", () => {
    const now = 2_000_000_000;

    // Exactly CACHE_LRU_COUNT entries, all fresh
    const collections: Record<string, { timestamp: number }> = {};
    for (let i = 0; i < CACHE_LRU_COUNT; i++) {
      collections[`col-${i}`] = { timestamp: now - i * 1000 };
    }

    const result = computeCacheEvictions(
      { collections, revisions: {} },
      now,
    );

    expect(result.collectionDrops).toHaveLength(0);
  });

  it("drops both expired collections and revisions in one call", () => {
    const now = 2_000_000_000;

    const collections = {
      old: { timestamp: now - CACHE_EXPIRE_MS - 1 },
    };
    const revisions = {
      99: { timestamp: now - CACHE_EXPIRE_MS - 1 },
    };

    const result = computeCacheEvictions(
      { collections, revisions },
      now,
    );

    expect(result.collectionDrops.length).toBeGreaterThan(0);
    expect(result.revisionDrops.length).toBeGreaterThan(0);
  });
});
