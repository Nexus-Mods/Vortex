import createClient, { type Middleware } from "openapi-fetch";

import { V3ApiError } from "./errors";
import type { components, paths } from "./generated/nexus-api-v3";

export interface NexusV3ClientOptions {
  baseUrl: string;
  /** User-Agent header, e.g. `Vortex/1.2.3`. The caller supplies the app version. */
  userAgent?: string;
  apiKey?: string;
  bearerToken?: string;
  middleware?: Middleware[];
}

export type NexusV3Client = ReturnType<typeof createNexusV3Client>;

export function createNexusV3Client(options: NexusV3ClientOptions) {
  const headers: Record<string, string> = {};

  if (options.userAgent) {
    headers["User-Agent"] = options.userAgent;
  }

  if (options.bearerToken) {
    headers["Authorization"] = `Bearer ${options.bearerToken}`;
  } else if (options.apiKey) {
    headers["apikey"] = options.apiKey;
  }

  const client = createClient<paths>({
    baseUrl: options.baseUrl,
    headers,
  });

  for (const mw of options.middleware ?? []) {
    client.use(mw);
  }

  // Wrap the client methods to throw V3ApiError on error responses
  return {
    ...client,

    async createUpload(sizeBytes: number, filename: string) {
      const { data, error, response } = await client.POST("/uploads", {
        body: { size_bytes: sizeBytes, filename },
      });
      if (error) throw toV3Error(error, response);
      return data.data;
    },

    async createMultipartUpload(sizeBytes: number, filename: string) {
      const { data, error, response } = await client.POST("/uploads/multipart", {
        body: { size_bytes: sizeBytes, filename },
      });
      if (error) throw toV3Error(error, response);
      return data.data;
    },

    async finaliseUpload(uploadId: string) {
      const { data, error, response } = await client.POST("/uploads/{id}/finalise", {
        params: { path: { id: uploadId } },
      });
      if (error) throw toV3Error(error, response);
      return data.data;
    },

    async getUpload(uploadId: string) {
      const { data, error, response } = await client.GET("/uploads/{id}", {
        params: { path: { id: uploadId } },
      });
      if (error) throw toV3Error(error, response);
      return data.data;
    },

    async createCollection(
      uploadId: string,
      collectionData: paths["/collections"]["post"]["requestBody"]["content"]["application/json"]["collection_data"],
    ) {
      const { data, error, response } = await client.POST("/collections", {
        body: { upload_id: uploadId, collection_data: collectionData },
      });
      if (error) throw toV3Error(error, response);
      return data.data;
    },

    async createCollectionRevision(
      collectionId: string,
      uploadId: string,
      collectionData: paths["/collections/{id}/revisions"]["post"]["requestBody"]["content"]["application/json"]["collection_data"],
    ) {
      const { data, error, response } = await client.POST("/collections/{id}/revisions", {
        params: { path: { id: collectionId } },
        body: { upload_id: uploadId, collection_data: collectionData },
      });
      if (error) throw toV3Error(error, response);
      return data.data;
    },

    async editCollection(
      collectionId: number,
      patch: paths["/collections/{id}"]["patch"]["requestBody"]["content"]["application/json"],
    ) {
      const { error, response } = await client.PATCH("/collections/{id}", {
        params: { path: { id: collectionId } },
        body: patch,
      });
      if (error) throw toV3Error(error, response);
    },

    /**
     * Fetch one page of materialized dependency candidates for a set of source
     * mod file versions. Results are paged; callers page until `meta.total_count`
     * rows have been read. Up to 5000 `versionIds` per call.
     */
    async getModFileVersionDependencyCandidatesBatch(
      versionIds: readonly string[],
      page: number,
      pageSize: number,
    ): Promise<{
      candidates: components["schemas"]["ModFileVersionDependencyCandidate"][];
      meta: components["schemas"]["PaginationMeta"];
    }> {
      const { data, error, response } = await client.POST(
        "/mod-file-versions/dependencies/materialized/batch",
        { body: { version_ids: [...versionIds], page, page_size: pageSize } },
      );
      if (error) throw toV3Error(error, response);
      return { candidates: Array.from(data.data.candidates), meta: data.meta };
    },

    /**
     * Resolve mod file version details (mod file/update group, name, version)
     * for a set of versions. Up to 2000 `versionIds` per call; unknown or
     * non-visible versions are omitted from the result.
     */
    async getModFileVersionsBatch(
      versionIds: readonly string[],
    ): Promise<components["schemas"]["ModFileVersionDetail"][]> {
      const { data, error, response } = await client.POST("/mod-file-versions/batch", {
        body: { version_ids: [...versionIds] },
      });
      if (error) throw toV3Error(error, response);
      return Array.from(data.data.versions);
    },

    /**
     * Resolve mod-level display details (name, summary, status, thumbnail, adult
     * flag) for a set of composite mod UIDs. Up to 2000 `modIds` per call;
     * unknown ids are omitted from the result.
     */
    async getModsBatch(modIds: readonly string[]): Promise<components["schemas"]["ModDetail"][]> {
      const { data, error, response } = await client.POST("/mods/batch", {
        body: { mod_ids: [...modIds] },
      });
      if (error) throw toV3Error(error, response);
      return Array.from(data.data.mods);
    },
  };
}

function toV3Error(error: unknown, response: Response): V3ApiError {
  // openapi-fetch returns the parsed error body. For problem+json responses,
  // this will be a ProblemDetails or ValidationProblem object — but proxies,
  // 502 pages, and transport errors can all produce other shapes, so we fall
  // back to the HTTP response whenever a field is missing.
  const problem: Record<string, unknown> =
    typeof error === "object" && error !== null ? Object.fromEntries(Object.entries(error)) : {};

  return new V3ApiError({
    type: typeof problem.type === "string" ? problem.type : "about:blank",
    title:
      typeof problem.title === "string" && problem.title.length > 0
        ? problem.title
        : `HTTP ${response.status}`,
    status: typeof problem.status === "number" ? problem.status : response.status,
    detail:
      typeof problem.detail === "string"
        ? problem.detail
        : error instanceof Error
          ? error.message
          : "",
    instance: typeof problem.instance === "string" ? problem.instance : response.url,
    errors: Array.isArray(problem.errors)
      ? (problem.errors as V3ApiError["validationErrors"])
      : undefined,
  });
}
