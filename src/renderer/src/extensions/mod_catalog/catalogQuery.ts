import type { CatalogSort, ICatalogMod, ICatalogPage, ICatalogSearch } from "./types";

/**
 * Builds the Nexus Mods GraphQL v2 `mods` query for the catalog and maps its result.
 *
 * Checked against the API on 25.10.2026 (see progress.md): `mods(filter, sort, count)` with
 * `gameId`/`name` filters of `[{ value, op }]` and `sort: [{ downloads: { direction: DESC } }]`
 * works without logging in. The field and filter names below come from the `ModsFilter` and
 * `Mod` types listed in progress.md and from the `IMod` type of `@nexusmods/nexus-api`.
 */

export const PAGE_SIZE = 20;

/** Wildcard search needs at least two characters (the API rejects shorter values). */
export const MIN_SEARCH_LENGTH = 2;

/** `Mod` field each sort option orders by, always descending. */
export const SORT_FIELDS: Record<CatalogSort, string> = {
  popular: "downloads",
  newest: "createdAt",
  updated: "updatedAt",
  endorsed: "endorsements",
};

const MOD_FIELDS = `
      uid
      modId
      name
      summary
      author
      version
      pictureUrl
      thumbnailUrl
      downloads
      endorsements
      createdAt
      updatedAt
      adultContent
      status
      modCategory { name }
      uploader { name avatar }`;

/**
 * The sort is written into the query rather than passed as a variable: it is a fixed value
 * from SORT_FIELDS, and inlining it avoids depending on the name of the sort input type.
 */
export function buildModsQuery(sort: CatalogSort): string {
  return (
    "query CatalogMods($filter: ModsFilter, $count: Int, $offset: Int) {\n" +
    `  mods(filter: $filter, sort: [{ ${SORT_FIELDS[sort]}: { direction: DESC } }], ` +
    "count: $count, offset: $offset) {\n" +
    "    totalCount\n" +
    `    nodes {${MOD_FIELDS}\n    }\n` +
    "  }\n" +
    "}"
  );
}

interface IFilterValue {
  value: string | boolean;
  op: "EQUALS" | "WILDCARD";
}

export function normalizeSearch(search: string): string | undefined {
  const trimmed = search.trim();
  return trimmed.length >= MIN_SEARCH_LENGTH ? trimmed : undefined;
}

export function buildModsFilter(params: ICatalogSearch): Record<string, IFilterValue[]> {
  const filter: Record<string, IFilterValue[]> = {
    gameDomainName: [{ value: params.gameDomain, op: "EQUALS" }],
  };
  const search = normalizeSearch(params.search);
  if (search !== undefined) {
    filter.name = [{ value: search, op: "WILDCARD" }];
  }
  if (params.category !== undefined && params.category.length > 0) {
    filter.categoryName = [{ value: params.category, op: "EQUALS" }];
  }
  if (!params.showAdult) {
    filter.adultContent = [{ value: false, op: "EQUALS" }];
  }
  return filter;
}

export function buildModsVariables(params: ICatalogSearch): Record<string, unknown> {
  return {
    filter: buildModsFilter(params),
    count: params.count,
    offset: params.offset,
  };
}

/** Key under which a page is cached; every parameter that changes the result is in it. */
export function cacheKey(params: ICatalogSearch): string {
  return JSON.stringify([
    params.gameDomain,
    normalizeSearch(params.search) ?? "",
    params.category ?? "",
    params.sort,
    params.showAdult,
    params.offset,
    params.count,
  ]);
}

// --- result mapping ---

interface IRawMod {
  uid?: string | number | null;
  modId?: number | string | null;
  name?: string | null;
  summary?: string | null;
  author?: string | null;
  version?: string | null;
  pictureUrl?: string | null;
  thumbnailUrl?: string | null;
  downloads?: number | null;
  endorsements?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  adultContent?: boolean | null;
  status?: string | null;
  modCategory?: { name?: string | null } | null;
  uploader?: { name?: string | null; avatar?: string | null } | null;
}

export interface IRawModsResponse {
  mods?: { totalCount?: number | null; nodes?: Array<IRawMod | null> | null } | null;
}

const orUndefined = <T>(value: T | null | undefined): T | undefined => value ?? undefined;

export function mapCatalogMod(raw: IRawMod): ICatalogMod | undefined {
  const modId = Number(raw.modId);
  if (!Number.isFinite(modId) || modId <= 0) {
    return undefined;
  }
  const uploaderName = orUndefined(raw.uploader?.name);
  return {
    modId,
    uid: raw.uid !== undefined && raw.uid !== null ? String(raw.uid) : undefined,
    name: raw.name ?? `Mod ${modId}`,
    summary: raw.summary ?? "",
    // `author` is what the uploader typed as credits; fall back to the uploader's name
    author: raw.author || uploaderName || "",
    uploaderName,
    uploaderAvatar: orUndefined(raw.uploader?.avatar),
    version: raw.version ?? "",
    pictureUrl: orUndefined(raw.pictureUrl),
    thumbnailUrl: orUndefined(raw.thumbnailUrl) ?? orUndefined(raw.pictureUrl),
    downloads: raw.downloads ?? 0,
    endorsements: raw.endorsements ?? 0,
    createdAt: orUndefined(raw.createdAt),
    updatedAt: orUndefined(raw.updatedAt),
    category: orUndefined(raw.modCategory?.name),
    adultContent: raw.adultContent === true,
    status: orUndefined(raw.status),
  };
}

export function mapModsResponse(res: IRawModsResponse): ICatalogPage {
  const nodes = res.mods?.nodes ?? [];
  const mods = nodes
    .filter((node): node is IRawMod => node !== null && node !== undefined)
    .map(mapCatalogMod)
    .filter((mod): mod is ICatalogMod => mod !== undefined);
  return { mods, totalCount: res.mods?.totalCount ?? mods.length };
}

/** Appends a newly loaded page, dropping mods already shown (pages can shift while browsing). */
export function appendPage(current: ICatalogMod[], next: ICatalogMod[]): ICatalogMod[] {
  const seen = new Set(current.map((mod) => mod.modId));
  return current.concat(next.filter((mod) => !seen.has(mod.modId)));
}
