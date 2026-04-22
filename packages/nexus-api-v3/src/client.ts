import createClient, { type Middleware } from "openapi-fetch";

import type { paths } from "./generated/nexus-api-v3";
import { V3ApiError } from "./errors";

export interface NexusV3ClientOptions {
  baseUrl: string;
  apiKey?: string;
  bearerToken?: string;
  middleware?: Middleware[];
}

export type NexusV3Client = ReturnType<typeof createNexusV3Client>;

export function createNexusV3Client(options: NexusV3ClientOptions) {
  const headers: Record<string, string> = {
    "User-Agent": "Vortex",
  };

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
      const { data, error, response } = await client.POST(
        "/uploads/multipart",
        {
          body: { size_bytes: sizeBytes, filename },
        },
      );
      if (error) throw toV3Error(error, response);
      return data.data;
    },

    async finaliseUpload(uploadId: string) {
      const { data, error, response } = await client.POST(
        "/uploads/{id}/finalise",
        {
          params: { path: { id: uploadId } },
        },
      );
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
      const { data, error, response } = await client.POST(
        "/collections/{id}/revisions",
        {
          params: { path: { id: collectionId } },
          body: { upload_id: uploadId, collection_data: collectionData },
        },
      );
      if (error) throw toV3Error(error, response);
      return data.data;
    },
  };
}

function toV3Error(error: unknown, response: Response): V3ApiError {
  // openapi-fetch returns the parsed error body. For problem+json responses,
  // this will be a ProblemDetails or ValidationProblem object — but proxies,
  // 502 pages, and transport errors can all produce other shapes, so we fall
  // back to the HTTP response whenever a field is missing.
  const problem =
    error && typeof error === "object" ? (error as Record<string, unknown>) : {};

  return new V3ApiError({
    type: typeof problem.type === "string" ? problem.type : "about:blank",
    title:
      typeof problem.title === "string" && problem.title.length > 0
        ? problem.title
        : `HTTP ${response.status}`,
    status:
      typeof problem.status === "number" ? problem.status : response.status,
    detail:
      typeof problem.detail === "string"
        ? problem.detail
        : error instanceof Error
          ? error.message
          : "",
    instance:
      typeof problem.instance === "string" ? problem.instance : response.url,
    errors: Array.isArray(problem.errors)
      ? (problem.errors as V3ApiError["validationErrors"])
      : undefined,
  });
}
