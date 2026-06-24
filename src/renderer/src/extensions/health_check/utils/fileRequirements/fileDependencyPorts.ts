import type {
  CandidateRow,
  FileVersionDetail,
  ModDetail,
  ResolverPorts,
} from "@nexusmods/file-dependency-resolver";
import type { components } from "@vortex/nexus-api-v3";

import { getModDetails } from "@/extensions/health_check/utils/shared/modDetails";
import { createVortexNexusV3Client } from "@/extensions/nexus_integration/nexusV3Client";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { createKeyedCache, resolveCached, type KeyedCache } from "./fileDependencyCache";

type V3Client = ReturnType<typeof createVortexNexusV3Client>;
type V3Candidate = components["schemas"]["ModFileVersionDependencyCandidate"];
type V3VersionDetail = components["schemas"]["ModFileVersionDetail"];
type V3Category = components["schemas"]["ModFileCategory"];

// Per-request id limits and page size imposed by the v3 batch endpoints.
const MAX_CANDIDATE_SOURCE_IDS = 5000;
const MAX_DETAIL_IDS = 2000;
const CANDIDATE_PAGE_SIZE = 5000;

// Candidates and version details rarely change between runs; cache for a while.
const CACHE_TTL_MS = 60 * 60 * 1000;

// Legacy numeric file category codes the resolver classifies on.
const CATEGORY_CODES: Record<V3Category, number> = {
  main: 1,
  update: 2,
  optional: 3,
  old_version: 4,
  miscellaneous: 5,
  removed: 6,
  archived: 7,
  unknown: 0,
};

function toCandidateRow(row: V3Candidate): CandidateRow {
  return {
    sourceFileVersionUid: row.source_version_id,
    definitionId: row.definition_id,
    modFileId: row.mod_file_id,
    fileVersionUid: row.version_id,
    position: row.position,
    category: CATEGORY_CODES[row.category],
    modStatus: row.mod_status,
    modUid: row.mod_id,
  };
}

function toFileVersionDetail(row: V3VersionDetail): FileVersionDetail {
  return {
    fileVersionUid: row.id,
    modUid: row.mod_id,
    modFileId: row.mod_file_id,
    name: row.name,
    version: row.version,
  };
}

function* chunked<T>(items: T[], size: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += size) {
    yield items.slice(i, i + size);
  }
}

// --- endpoint interaction + pagination ---

/** Read every candidate row for the given source versions, across id chunks and pages. */
async function fetchCandidateRows(client: V3Client, sourceIds: string[]): Promise<V3Candidate[]> {
  const pages: V3Candidate[][] = [];

  for (const ids of chunked(sourceIds, MAX_CANDIDATE_SOURCE_IDS)) {
    let page = 1;
    let fetched = 0;
    let hasMore = true;
    while (hasMore) {
      const { candidates, meta } = await client.getModFileVersionDependencyCandidatesBatch(
        ids,
        page,
        CANDIDATE_PAGE_SIZE,
      );
      pages.push(candidates);
      fetched += candidates.length;
      hasMore = candidates.length > 0 && fetched < meta.total_count;
      page += 1;
    }
  }

  return pages.flat();
}

/** Read version details for the given versions, across id chunks. */
async function fetchVersionDetailRows(
  client: V3Client,
  versionIds: string[],
): Promise<V3VersionDetail[]> {
  const pages: V3VersionDetail[][] = [];
  for (const ids of chunked(versionIds, MAX_DETAIL_IDS)) {
    pages.push(await client.getModFileVersionsBatch(ids));
  }
  return pages.flat();
}

/** Group rows by source version, seeding every requested source so empties cache too. */
function groupBySource(sourceIds: string[], rows: CandidateRow[]): Map<string, CandidateRow[]> {
  const bySource = new Map<string, CandidateRow[]>(
    sourceIds.map((id): [string, CandidateRow[]] => [id, []]),
  );
  for (const row of rows) {
    bySource.get(row.sourceFileVersionUid)?.push(row);
  }
  return bySource;
}

// Cross-run caches keyed by the (globally unique) source/version uids.
const candidateCache: KeyedCache<CandidateRow[]> = createKeyedCache(CACHE_TTL_MS);
const detailCache: KeyedCache<FileVersionDetail> = createKeyedCache(CACHE_TTL_MS);

/**
 * Build the resolver ports for the active session. Candidate and version
 * detail data comes from the Nexus v3 batch endpoints (paged and cached); mod
 * details go through the existing v2 GraphQL accessor.
 */
export function createResolverPorts(api: IExtensionApi): ResolverPorts {
  const client = createVortexNexusV3Client(api);

  return {
    async fetchCandidates(fileVersionUids) {
      const bySource = await resolveCached(fileVersionUids, candidateCache, async (missing) =>
        groupBySource(missing, (await fetchCandidateRows(client, missing)).map(toCandidateRow)),
      );
      return [...bySource.values()].flat();
    },

    async fetchFileVersionDetails(fileVersionUids) {
      const byId = await resolveCached(fileVersionUids, detailCache, async (missing) => {
        const details = (await fetchVersionDetailRows(client, missing)).map(toFileVersionDetail);
        return new Map(details.map((detail) => [detail.fileVersionUid, detail]));
      });
      return [...byId.values()];
    },

    async fetchModDetails(modUids) {
      const details = await getModDetails(api, modUids);
      return details.map(
        (detail): ModDetail => ({
          modUid: detail.modUID,
          name: detail.modName,
          summary: detail.modSummary,
          thumbnailUrl: detail.thumbnailUrl,
          adultContent: detail.adultContent,
        }),
      );
    },
  };
}
