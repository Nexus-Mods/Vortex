import { GameDomain } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import {
  appendPage,
  buildModsFilter,
  buildModsQuery,
  buildModsVariables,
  cacheKey,
  mapCatalogMod,
  mapModsResponse,
  normalizeSearch,
} from "./catalogQuery";
import type { ICatalogSearch } from "./types";

const base: ICatalogSearch = {
  gameDomain: GameDomain("cyberpunk2077"),
  search: "",
  sort: "popular",
  showAdult: false,
  offset: 0,
  count: 20,
};

describe("buildModsQuery", () => {
  it("asks for the fields a catalog card needs, sorted as chosen", () => {
    const query = buildModsQuery("popular");
    expect(query).toContain("mods(filter: $filter, sort: [{ downloads: { direction: DESC } }]");
    expect(query).toContain("$filter: ModsFilter");
    for (const field of [
      "modId",
      "name",
      "summary",
      "author",
      "thumbnailUrl",
      "downloads",
      "endorsements",
      "updatedAt",
      "adultContent",
      "totalCount",
    ]) {
      expect(query).toContain(field);
    }
  });

  it.each([
    ["newest", "createdAt"],
    ["updated", "updatedAt"],
    ["endorsed", "endorsements"],
  ] as const)("sorts %s by %s", (sort, field) => {
    expect(buildModsQuery(sort)).toContain(`sort: [{ ${field}: { direction: DESC } }]`);
  });
});

describe("buildModsFilter", () => {
  it("limits to the game and hides adult mods by default", () => {
    expect(buildModsFilter(base)).toEqual({
      gameDomainName: [{ value: "cyberpunk2077", op: "EQUALS" }],
      adultContent: [{ value: false, op: "EQUALS" }],
    });
  });

  it("shows adult mods only when asked to", () => {
    expect(buildModsFilter({ ...base, showAdult: true }).adultContent).toBeUndefined();
  });

  it("searches names with a wildcard", () => {
    expect(buildModsFilter({ ...base, search: "  redscript " }).name).toEqual([
      { value: "redscript", op: "WILDCARD" },
    ]);
  });

  it("ignores searches the API would reject", () => {
    expect(buildModsFilter({ ...base, search: "r" }).name).toBeUndefined();
    expect(normalizeSearch(" r ")).toBeUndefined();
    expect(normalizeSearch("ab")).toBe("ab");
  });

  it("filters by category name", () => {
    expect(buildModsFilter({ ...base, category: "Gameplay" }).categoryName).toEqual([
      { value: "Gameplay", op: "EQUALS" },
    ]);
    expect(buildModsFilter({ ...base, category: "" }).categoryName).toBeUndefined();
  });

  it("passes paging as variables", () => {
    expect(buildModsVariables({ ...base, offset: 40 })).toMatchObject({ count: 20, offset: 40 });
  });
});

describe("cacheKey", () => {
  it("differs for every parameter that changes the result", () => {
    const keys = new Set([
      cacheKey(base),
      cacheKey({ ...base, search: "abc" }),
      cacheKey({ ...base, category: "Gameplay" }),
      cacheKey({ ...base, sort: "newest" }),
      cacheKey({ ...base, showAdult: true }),
      cacheKey({ ...base, offset: 20 }),
    ]);
    expect(keys.size).toBe(6);
  });

  it("treats a search too short to send like no search", () => {
    expect(cacheKey({ ...base, search: "a" })).toBe(cacheKey(base));
  });
});

describe("mapping", () => {
  const raw = {
    uid: "14316010110071",
    modId: 1511,
    name: "redscript",
    summary: "Compiler",
    author: "jekky",
    version: "0.5.27",
    thumbnailUrl: "https://example.invalid/thumb.jpg",
    pictureUrl: "https://example.invalid/pic.jpg",
    downloads: 1000,
    endorsements: 50,
    createdAt: "2021-01-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    adultContent: false,
    status: "published",
    modCategory: { name: "Modders Resources" },
    uploader: { name: "jekky", avatar: "https://example.invalid/a.png" },
  };

  it("maps API fields to a catalog mod", () => {
    expect(mapCatalogMod(raw)).toEqual({
      modId: 1511,
      uid: "14316010110071",
      name: "redscript",
      summary: "Compiler",
      author: "jekky",
      uploaderName: "jekky",
      uploaderAvatar: "https://example.invalid/a.png",
      version: "0.5.27",
      pictureUrl: "https://example.invalid/pic.jpg",
      thumbnailUrl: "https://example.invalid/thumb.jpg",
      downloads: 1000,
      endorsements: 50,
      createdAt: "2021-01-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
      category: "Modders Resources",
      adultContent: false,
      status: "published",
    });
  });

  it("fills gaps with safe defaults", () => {
    const mod = mapCatalogMod({ modId: "7", uploader: { name: "up" }, pictureUrl: "p.png" });
    expect(mod).toMatchObject({
      modId: 7,
      name: "Mod 7",
      author: "up",
      summary: "",
      version: "",
      downloads: 0,
      endorsements: 0,
      adultContent: false,
      thumbnailUrl: "p.png",
    });
  });

  it("drops entries without a usable mod id", () => {
    expect(mapCatalogMod({ name: "broken" })).toBeUndefined();
    const page = mapModsResponse({ mods: { totalCount: 3, nodes: [raw, null, { name: "x" }] } });
    expect(page.mods.map((mod) => mod.modId)).toEqual([1511]);
    expect(page.totalCount).toBe(3);
  });

  it("copes with an empty response", () => {
    expect(mapModsResponse({})).toEqual({ mods: [], totalCount: 0 });
  });

  it("does not show a mod twice when pages shift", () => {
    const first = [mapCatalogMod(raw)!];
    const merged = appendPage(first, [mapCatalogMod(raw)!, mapCatalogMod({ ...raw, modId: 2 })!]);
    expect(merged.map((mod) => mod.modId)).toEqual([1511, 2]);
  });
});
