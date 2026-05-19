import Nexus from "@nexusmods/nexus-api";
import { RateLimiter } from "limiter";

import { fetchFileManifest } from "./manifest";
import { withRetry } from "./retry";

export interface INexusClient {
  listMostPopular(gameDomain: string, limit: number): Promise<INexusModSummary[]>;
  listMostRecent(gameDomain: string, limit: number): Promise<INexusModSummary[]>;
  listOldest(gameDomain: string, limit: number): Promise<INexusModSummary[]>;
  /**
   * Enumerate every mod for the game via paginated GraphQL. Caller is
   * responsible for the per-mod `listModFiles` follow-up.
   */
  listAllMods(gameDomain: string): Promise<INexusModSummary[]>;
  listCollections(gameDomain: string): Promise<INexusCollectionSummary[]>;
  listCollectionMods(gameDomain: string, collectionSlug: string): Promise<INexusModSummary[]>;
  listModFiles(gameDomain: string, modId: number): Promise<INexusFileSummary[]>;
  /**
   * Fetch the content-preview JSON for a file and flatten it into the list of
   * file paths inside the archive. Throws if the URL is empty or the fetch
   * fails.
   */
  getFileManifest(contentPreviewLink: string): Promise<string[]>;
}

export interface INexusModSummary {
  modId: number;
  name: string;
}

export interface INexusCollectionSummary {
  slug: string;
  name: string;
}

export interface INexusFileSummary {
  fileId: number;
  /** Display name (human-readable, no extension). */
  name: string;
  /** Actual filename with extension. */
  fileName: string;
  /** Nexus category: "MAIN", "PATCH", "OPTIONAL", "OLD_VERSION", "MISCELLANEOUS", "DELETED", "ARCHIVED". */
  categoryName: string;
  uploadedAt: Date;
  /** URL of the archive content-preview JSON; empty string if not provided. */
  contentPreviewLink: string;
}

/** api.nexusmods.com is rate-limited; longer backoff than the unmetered CDN fetches in `manifest.ts`. */
const SDK_RETRY = { maxAttempts: 4, baseDelayMs: 1000, maxDelayMs: 30_000 } as const;

/** ~25 requests per second matches the published Nexus API quota with a small safety margin. */
const RATE_LIMIT_PER_SEC = 25;

/** GraphQL page size for `listAllMods`. */
const GRAPHQL_PAGE_SIZE = 100;

/** Default page size for collection-listing GraphQL calls. */
const COLLECTION_LIST_PAGE_SIZE = 100;

/**
 * The Nexus SDK's type surface in v1.6.0 is incomplete: `getModFiles` results
 * include `file_name` / `category_name` that aren't declared, and the
 * collection GraphQL methods aren't on the typed interface at all. We cast
 * once at the boundary so consumer code can stay strictly-typed.
 */
interface IRawNexusFile {
  file_id: number;
  name: string;
  uploaded_timestamp: number;
  file_name?: string;
  category_name?: string;
  content_preview_link?: string;
}

interface IRawNexusCollectionListItem {
  slug?: string;
  name?: string;
}

interface IRawNexusCollectionDetail {
  currentRevision?: { modFiles?: Array<{ file?: { modId?: number; name?: string } }> };
}

interface INexusGraphQL {
  getCollectionListGraph(
    query: object,
    gameDomain: string,
    count: number,
    offset: number,
  ): Promise<IRawNexusCollectionListItem[]>;
  getCollectionGraph(
    query: object,
    slug: string,
    adult: boolean,
  ): Promise<IRawNexusCollectionDetail>;
}

interface IListAllModsResponse {
  data?: {
    mods?: { totalCount?: number; nodes?: Array<{ modId: number; name: string }> };
  };
  errors?: Array<{ message: string }>;
}

export function createNexusClient(apiKey: string): INexusClient {
  const limiter = new RateLimiter({ tokensPerInterval: RATE_LIMIT_PER_SEC, interval: "second" });

  let nexusPromise: Promise<Nexus> | undefined;

  function getNexus(): Promise<Nexus> {
    if (!nexusPromise) {
      nexusPromise = Nexus.create(apiKey, "vortex-game-extension-test", "1.0.0", "site");
    }
    return nexusPromise;
  }

  async function call<T>(fn: (nexus: Nexus) => Promise<T>): Promise<T> {
    await limiter.removeTokens(1);
    const nexus = await getNexus();
    return withRetry(() => fn(nexus), SDK_RETRY);
  }

  return {
    // getTrending sorts by endorsements/popularity.
    async listMostPopular(gameDomain: string, limit: number): Promise<INexusModSummary[]> {
      const results = await call((nexus) => nexus.getTrending(gameDomain));
      return results.slice(0, limit).map((m) => ({ modId: m.mod_id, name: m.name ?? "" }));
    },

    async listMostRecent(gameDomain: string, limit: number): Promise<INexusModSummary[]> {
      const results = await call((nexus) => nexus.getLatestAdded(gameDomain));
      return results.slice(0, limit).map((m) => ({ modId: m.mod_id, name: m.name ?? "" }));
    },

    // The REST API has no "oldest" sort; getLatestUpdated returns ascending by
    // update time, so reversing puts the least-recently-updated mods first.
    // This is the closest approximation available in @nexusmods/nexus-api v1.6.0.
    async listOldest(gameDomain: string, limit: number): Promise<INexusModSummary[]> {
      const results = await call((nexus) => nexus.getLatestUpdated(gameDomain));
      return results
        .slice()
        .reverse()
        .slice(0, limit)
        .map((m) => ({ modId: m.mod_id, name: m.name ?? "" }));
    },

    // The SDK doesn't expose raw GraphQL on the typed surface, so hit
    // /v2/graphql directly. Wrapped in withRetry to match call()'s protection.
    async listAllMods(gameDomain: string): Promise<INexusModSummary[]> {
      const out: INexusModSummary[] = [];
      let offset = 0;
      while (true) {
        const data = await withRetry(async () => {
          await limiter.removeTokens(1);
          const resp = await fetch("https://api.nexusmods.com/v2/graphql", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              APIKEY: apiKey,
            },
            body: JSON.stringify({
              query:
                "query($domain: String!, $count: Int!, $offset: Int!) {" +
                " mods(filter: { filter: [{ gameDomainName: { value: $domain, op: EQUALS } }] }, count: $count, offset: $offset) {" +
                "   totalCount nodes { modId name }" +
                " } }",
              variables: { domain: gameDomain, count: GRAPHQL_PAGE_SIZE, offset },
            }),
          });
          if (!resp.ok) {
            // Tag with `status` so withRetry only retries 408/429/5xx.
            const err = Object.assign(new Error(`listAllMods: HTTP ${resp.status}`), {
              status: resp.status,
            });
            throw err;
          }
          const json = (await resp.json()) as IListAllModsResponse;
          if (json.errors?.length) {
            // GraphQL semantic errors arrive over 200; tag non-retryable so
            // withRetry fails fast.
            const err = Object.assign(
              new Error(`listAllMods GraphQL: ${json.errors.map((e) => e.message).join("; ")}`),
              { status: 400 },
            );
            throw err;
          }
          return json;
        }, SDK_RETRY);

        const page = data.data?.mods?.nodes ?? [];
        for (const m of page) out.push({ modId: m.modId, name: m.name ?? "" });
        const total = data.data?.mods?.totalCount ?? 0;
        offset += page.length;
        if (offset >= total || page.length === 0) break;
      }
      return out;
    },

    async listCollections(gameDomain: string): Promise<INexusCollectionSummary[]> {
      const query = { slug: true, name: true };
      const results = await call((nexus) =>
        (nexus as unknown as INexusGraphQL).getCollectionListGraph(
          query,
          gameDomain,
          COLLECTION_LIST_PAGE_SIZE,
          0,
        ),
      );
      return results.map((c) => ({
        slug: c.slug ?? "",
        name: c.name ?? "",
      }));
    },

    async listCollectionMods(
      gameDomain: string,
      collectionSlug: string,
    ): Promise<INexusModSummary[]> {
      const query = {
        slug: true,
        name: true,
        currentRevision: {
          modFiles: {
            file: {
              modId: true,
              name: true,
            },
          },
        },
      };
      const collection = await call((nexus) =>
        (nexus as unknown as INexusGraphQL).getCollectionGraph(query, collectionSlug, false),
      );

      const modFiles = collection.currentRevision?.modFiles ?? [];
      return modFiles
        .filter((mf) => mf.file?.modId != null)
        .map((mf) => ({
          modId: mf.file!.modId as number,
          name: mf.file!.name ?? "",
        }));
    },

    async listModFiles(gameDomain: string, modId: number): Promise<INexusFileSummary[]> {
      const result = await call((nexus) => nexus.getModFiles(modId, gameDomain));
      return (result.files as unknown as IRawNexusFile[]).map((f) => ({
        fileId: f.file_id,
        name: f.name,
        fileName: f.file_name ?? "",
        categoryName: f.category_name ?? "",
        uploadedAt: new Date(f.uploaded_timestamp * 1000),
        contentPreviewLink: f.content_preview_link ?? "",
      }));
    },

    getFileManifest: (contentPreviewLink: string) => fetchFileManifest(contentPreviewLink),
  };
}
