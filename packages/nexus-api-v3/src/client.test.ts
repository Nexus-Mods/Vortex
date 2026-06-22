import { beforeEach, describe, expect, it, vi } from "vitest";
import createFetchMock from "vitest-fetch-mock";

import { createNexusV3Client } from "./client";
import { V3ApiError } from "./errors";

// Mock at the fetch boundary so the real openapi-fetch stack runs: header
// merging, URL/path-param building, body serialization and response parsing
// are all exercised, not stubbed.
const fetchMocker = createFetchMock(vi);
fetchMocker.enableMocks();

const BASE_URL = "https://api.test/v3";

function makeClient(options: Partial<Parameters<typeof createNexusV3Client>[0]> = {}) {
  return createNexusV3Client({ baseUrl: BASE_URL, apiKey: "key", ...options });
}

function lastRequest(): Request {
  const request = fetchMocker.requests().at(-1);
  if (!request) throw new Error("no fetch request was recorded");
  return request;
}

async function lastBody(): Promise<Record<string, unknown>> {
  return JSON.parse(await lastRequest().text());
}

// Mocks a JSON success body of the shape the client unwraps ({ data: ... }).
function mockData(data: unknown, status = 200): void {
  fetchMocker.mockResponseOnce(JSON.stringify({ data }), { status });
}

// A minimal payload that satisfies the generated CollectionPayload type.
const collectionData = {
  adult_content: false,
  collection_manifest: {
    info: { author: "author", name: "My Collection", domain_name: "skyrimspecialedition" },
    mods: [],
  },
  collection_schema_id: 1,
};

beforeEach(() => {
  fetchMocker.resetMocks();
});

describe("auth headers", () => {
  it("sends the apikey header when apiKey is provided", async () => {
    mockData({ id: "upload-1" });
    await makeClient({ apiKey: "my-api-key" }).createUpload(1024, "file.zip");

    expect(lastRequest().headers.get("apikey")).toBe("my-api-key");
    expect(lastRequest().headers.get("authorization")).toBeNull();
  });

  it("sends the Authorization header when bearerToken is provided", async () => {
    mockData({ id: "upload-1" });
    await makeClient({ apiKey: undefined, bearerToken: "my-jwt" }).createUpload(1024, "file.zip");

    expect(lastRequest().headers.get("authorization")).toBe("Bearer my-jwt");
  });

  it("prefers bearerToken over apiKey", async () => {
    mockData({ id: "upload-1" });
    await makeClient({ apiKey: "my-api-key", bearerToken: "my-jwt" }).createUpload(
      1024,
      "file.zip",
    );

    expect(lastRequest().headers.get("authorization")).toBe("Bearer my-jwt");
    expect(lastRequest().headers.get("apikey")).toBeNull();
  });

  it("sends the user agent from options", async () => {
    mockData({ id: "upload-1" });
    await makeClient({ userAgent: "Vortex/1.2.3" }).createUpload(1024, "file.zip");

    expect(lastRequest().headers.get("user-agent")).toBe("Vortex/1.2.3");
  });
});

describe("createUpload", () => {
  it("POSTs size and filename to /uploads and returns the unwrapped data", async () => {
    mockData({ id: "upload-1", presigned_url: "https://s3/upload" });

    const result = await makeClient().createUpload(1024, "file.zip");

    expect(lastRequest().method).toBe("POST");
    expect(lastRequest().url).toBe(`${BASE_URL}/uploads`);
    expect(await lastBody()).toEqual({ size_bytes: 1024, filename: "file.zip" });
    expect(result.id).toBe("upload-1");
    expect(result.presigned_url).toBe("https://s3/upload");
  });

  it("throws V3ApiError on an error response", async () => {
    fetchMocker.mockResponseOnce(
      JSON.stringify({
        type: "about:blank",
        title: "Bad Request",
        status: 400,
        detail: "Invalid size",
        instance: "/uploads",
      }),
      { status: 400, headers: { "content-type": "application/problem+json" } },
    );

    await expect(makeClient().createUpload(-1, "file.zip")).rejects.toThrow(V3ApiError);
  });
});

describe("createMultipartUpload", () => {
  it("POSTs to /uploads/multipart", async () => {
    mockData({ id: "upload-2", parts: [] });

    const result = await makeClient().createMultipartUpload(8_000_000, "big.zip");

    expect(lastRequest().method).toBe("POST");
    expect(lastRequest().url).toBe(`${BASE_URL}/uploads/multipart`);
    expect(await lastBody()).toEqual({ size_bytes: 8_000_000, filename: "big.zip" });
    expect(result.id).toBe("upload-2");
  });
});

describe("finaliseUpload", () => {
  it("POSTs to /uploads/{id}/finalise with the id interpolated into the path", async () => {
    mockData({ id: "upload-1", state: "created" });

    await makeClient().finaliseUpload("upload-1");

    expect(lastRequest().method).toBe("POST");
    expect(lastRequest().url).toBe(`${BASE_URL}/uploads/upload-1/finalise`);
  });
});

describe("getUpload", () => {
  it("GETs /uploads/{id} and returns the state", async () => {
    mockData({ id: "upload-1", state: "available" });

    const result = await makeClient().getUpload("upload-1");

    expect(lastRequest().method).toBe("GET");
    expect(lastRequest().url).toBe(`${BASE_URL}/uploads/upload-1`);
    expect(result.state).toBe("available");
  });
});

describe("createCollection", () => {
  it("POSTs upload_id and collection_data to /collections", async () => {
    mockData({ id: "col-1", revision_id: "rev-1" });

    const result = await makeClient().createCollection("upload-1", collectionData);

    expect(lastRequest().method).toBe("POST");
    expect(lastRequest().url).toBe(`${BASE_URL}/collections`);
    expect(await lastBody()).toEqual({ upload_id: "upload-1", collection_data: collectionData });
    expect(result.id).toBe("col-1");
    expect(result.revision_id).toBe("rev-1");
  });

  it("surfaces validation errors from a 422 response", async () => {
    fetchMocker.mockResponseOnce(
      JSON.stringify({
        type: "about:blank",
        title: "Unprocessable Entity",
        status: 422,
        detail: "Validation failed",
        instance: "/collections",
        errors: [
          {
            detail: "mod_id is required",
            pointer: "/collection_data/collection_manifest/mods/0/source/mod_id",
          },
        ],
      }),
      { status: 422, headers: { "content-type": "application/problem+json" } },
    );

    const promise = makeClient().createCollection("upload-1", collectionData);

    await expect(promise).rejects.toBeInstanceOf(V3ApiError);
    await expect(promise).rejects.toMatchObject({
      status: 422,
      validationErrors: [expect.objectContaining({ pointer: expect.stringContaining("mod_id") })],
    });
  });
});

describe("createCollectionRevision", () => {
  it("POSTs to /collections/{id}/revisions with the id interpolated", async () => {
    mockData({ id: "rev-2", collection_id: "col-1" });

    const result = await makeClient().createCollectionRevision("col-1", "upload-1", collectionData);

    expect(lastRequest().method).toBe("POST");
    expect(lastRequest().url).toBe(`${BASE_URL}/collections/col-1/revisions`);
    expect(await lastBody()).toEqual({ upload_id: "upload-1", collection_data: collectionData });
    expect(result.id).toBe("rev-2");
    expect(result.collection_id).toBe("col-1");
  });
});

describe("editCollection", () => {
  it("PATCHes /collections/{id} with the patch body and resolves on 204", async () => {
    fetchMocker.mockResponseOnce(null, { status: 204 });

    await makeClient().editCollection(42, { name: "Renamed" });

    expect(lastRequest().method).toBe("PATCH");
    expect(lastRequest().url).toBe(`${BASE_URL}/collections/42`);
    expect(await lastBody()).toEqual({ name: "Renamed" });
  });

  it("throws V3ApiError on an error response", async () => {
    fetchMocker.mockResponseOnce(
      JSON.stringify({
        type: "about:blank",
        title: "Forbidden",
        status: 403,
        detail: "Not the owner",
      }),
      { status: 403, headers: { "content-type": "application/problem+json" } },
    );

    await expect(makeClient().editCollection(42, { name: "Renamed" })).rejects.toThrow(V3ApiError);
  });
});

describe("error fallback", () => {
  it("builds a V3ApiError from the HTTP response when the body is not problem+json", async () => {
    fetchMocker.mockResponseOnce("<html>502 Bad Gateway</html>", { status: 502 });

    const promise = makeClient().createUpload(1024, "file.zip");

    await expect(promise).rejects.toBeInstanceOf(V3ApiError);
    await expect(promise).rejects.toMatchObject({
      status: 502,
      message: "HTTP 502",
      problemType: "about:blank",
    });
  });
});
