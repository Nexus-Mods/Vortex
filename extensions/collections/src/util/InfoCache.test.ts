import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { util } from "vortex-api";

import InfoCache from "./InfoCache";
import { CACHE_EXPIRE_MS, CACHE_LRU_COUNT } from "../constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal mock of IExtensionApi for InfoCache. */
function makeMockApi(
  collections: any = {},
  revisions: any = {},
): { api: any; state: any } {
  const state = {
    persistent: {
      collections: {
        collections,
        revisions,
      },
    },
  };
  return {
    api: {
      store: {
        getState: () => state,
        dispatch: vi.fn(),
      },
      getState: () => state,
      emitAndAwait: vi.fn().mockResolvedValue([undefined]),
      showErrorNotification: vi.fn(),
    },
    state,
  };
}

// ---------------------------------------------------------------------------
// clearCache
// ---------------------------------------------------------------------------

describe("InfoCache.clearCache", () => {
  let nowSpy: ReturnType<typeof vi.spyOn>;
  let batchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    nowSpy = vi.spyOn(Date, "now");
    batchSpy = vi.spyOn(util, "batchDispatch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Collect all actions passed to batchDispatch across all calls. */
  function batchedActions(): any[] {
    return batchSpy.mock.calls.flatMap(([_store, actions]) => actions);
  }

  it("does nothing when caches are empty", async () => {
    const { api } = makeMockApi();
    nowSpy.mockReturnValue(Date.now());
    const cache = new InfoCache(api);

    await cache.clearCache();

    expect(batchSpy).not.toHaveBeenCalled();
  });

  it("drops collections older than CACHE_EXPIRE_MS", async () => {
    const now = 2_000_000_000;
    nowSpy.mockReturnValue(now);

    const collections = {
      fresh: { timestamp: now - 1000, info: {} },
      expired: { timestamp: now - CACHE_EXPIRE_MS - 1, info: {} },
    };

    const { api } = makeMockApi(collections);
    const cache = new InfoCache(api);

    await cache.clearCache();

    expect(batchSpy).toHaveBeenCalled();
    const actions = batchedActions();
    const droppedIds = actions
      .map((a: any) => a?.payload?.collectionId)
      .filter(Boolean);
    expect(droppedIds).toContain("expired");
    expect(droppedIds).not.toContain("fresh");
  });

  it("drops revisions older than CACHE_EXPIRE_MS", async () => {
    const now = 2_000_000_000;
    nowSpy.mockReturnValue(now);

    const revisions = {
      10: { timestamp: now - 1000, info: {} },
      20: { timestamp: now - CACHE_EXPIRE_MS - 1, info: {} },
    };

    const { api } = makeMockApi({}, revisions);
    const cache = new InfoCache(api);

    await cache.clearCache();

    expect(batchSpy).toHaveBeenCalled();
    const actions = batchedActions();
    const droppedIds = actions
      .map((a: any) => a?.payload?.revisionId)
      .filter((id: any) => id !== undefined);
    // Object.keys returns strings, so revisionId comes through as a string
    expect(droppedIds).toContain("20");
    expect(droppedIds).not.toContain("10");
  });

  it("enforces LRU limit by dropping oldest entries beyond CACHE_LRU_COUNT", async () => {
    const now = 2_000_000_000;
    nowSpy.mockReturnValue(now);

    // Create CACHE_LRU_COUNT + 5 entries, all within the expire window
    const collections: Record<string, any> = {};
    for (let i = 0; i < CACHE_LRU_COUNT + 5; i++) {
      // Newer entries get higher timestamps
      collections[`col-${i}`] = {
        timestamp: now - (CACHE_LRU_COUNT + 5 - i) * 1000,
        info: {},
      };
    }

    const { api } = makeMockApi(collections);
    const cache = new InfoCache(api);

    await cache.clearCache();

    expect(batchSpy).toHaveBeenCalled();
    const actions = batchedActions();
    const droppedCollections = actions
      .map((a: any) => a?.payload?.collectionId)
      .filter(Boolean);
    // Should drop at least the 5 that exceed the LRU count
    expect(droppedCollections.length).toBeGreaterThanOrEqual(5);
  });

  it("keeps all entries when count is at the LRU limit and none are expired", async () => {
    const now = 2_000_000_000;
    nowSpy.mockReturnValue(now);

    // Exactly CACHE_LRU_COUNT entries, all fresh
    const collections: Record<string, any> = {};
    for (let i = 0; i < CACHE_LRU_COUNT; i++) {
      collections[`col-${i}`] = {
        timestamp: now - i * 1000,
        info: {},
      };
    }

    const { api } = makeMockApi(collections);
    const cache = new InfoCache(api);

    await cache.clearCache();

    // batchDispatch should not have been called for collections
    // (it may or may not be called for empty revisions — either way, no collection drops)
    const actions = batchedActions();
    const droppedCollections = actions
      .map((a: any) => a?.payload?.collectionId)
      .filter(Boolean);
    expect(droppedCollections).toHaveLength(0);
  });

  it("drops both expired collections and revisions in one call", async () => {
    const now = 2_000_000_000;
    nowSpy.mockReturnValue(now);

    const collections = {
      old: { timestamp: now - CACHE_EXPIRE_MS - 1, info: {} },
    };
    const revisions = {
      99: { timestamp: now - CACHE_EXPIRE_MS - 1, info: {} },
    };

    const { api } = makeMockApi(collections, revisions);
    const cache = new InfoCache(api);

    await cache.clearCache();

    const actions = batchedActions();
    const collectionDrops = actions.filter(
      (a: any) => a?.payload?.collectionId !== undefined,
    );
    const revisionDrops = actions.filter(
      (a: any) => a?.payload?.revisionId !== undefined,
    );
    expect(collectionDrops.length).toBeGreaterThan(0);
    expect(revisionDrops.length).toBeGreaterThan(0);
  });
});
