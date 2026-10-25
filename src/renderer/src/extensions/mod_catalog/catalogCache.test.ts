import { describe, expect, it, vi } from "vitest";

import { CatalogCache } from "./catalogCache";

function makeCache(maxEntries = 10) {
  let now = 0;
  const cache = new CatalogCache<string>({ ttlMs: 1000, maxEntries, now: () => now });
  return { cache, advance: (ms: number) => (now += ms) };
}

describe("CatalogCache", () => {
  it("loads once and serves the cached value afterwards", async () => {
    const { cache } = makeCache();
    const load = vi.fn(async () => "page");
    expect(await cache.getOrLoad("k", load)).toBe("page");
    expect(await cache.getOrLoad("k", load)).toBe("page");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("shares a request that is still running", async () => {
    const { cache } = makeCache();
    let resolve: (value: string) => void = () => undefined;
    const load = vi.fn(() => new Promise<string>((res) => (resolve = res)));
    const first = cache.getOrLoad("k", load);
    const second = cache.getOrLoad("k", load);
    resolve("page");
    expect(await Promise.all([first, second])).toEqual(["page", "page"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("expires entries", async () => {
    const { cache, advance } = makeCache();
    const load = vi.fn(async () => "page");
    await cache.getOrLoad("k", load);
    advance(1001);
    await cache.getOrLoad("k", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not cache failures", async () => {
    const { cache } = makeCache();
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("page");
    await expect(cache.getOrLoad("k", load)).rejects.toThrow("offline");
    expect(await cache.getOrLoad("k", load)).toBe("page");
  });

  it("evicts the least recently used entry when full", () => {
    const { cache } = makeCache(2);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.get("a");
    cache.set("c", "3");
    expect(cache.get("a")).toBe("1");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe("3");
  });
});
