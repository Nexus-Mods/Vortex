import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNexusV3Client } from "./client";
import { V3ApiError } from "./errors";

// Mock openapi-fetch's createClient
vi.mock("openapi-fetch", () => ({
  default: vi.fn(() => ({
    GET: vi.fn(),
    POST: vi.fn(),
    PUT: vi.fn(),
  })),
}));

import createClient from "openapi-fetch";

const mockCreateClient = vi.mocked(createClient);

describe("createNexusV3Client", () => {
  let mockClient: {
    GET: ReturnType<typeof vi.fn>;
    POST: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      GET: vi.fn(),
      POST: vi.fn(),
    };
    mockCreateClient.mockReturnValue(mockClient as any);
  });

  describe("auth headers", () => {
    it("sets apikey header when apiKey is provided", () => {
      createNexusV3Client({
        baseUrl: "https://api.nexusmods.com/v3",
        apiKey: "my-api-key",
      });

      expect(mockCreateClient).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            apikey: "my-api-key",
          }),
        }),
      );
    });

    it("sets Authorization header when bearerToken is provided", () => {
      createNexusV3Client({
        baseUrl: "https://api.nexusmods.com/v3",
        bearerToken: "my-jwt-token",
      });

      expect(mockCreateClient).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer my-jwt-token",
          }),
        }),
      );
    });

    it("prefers bearerToken over apiKey", () => {
      createNexusV3Client({
        baseUrl: "https://api.nexusmods.com/v3",
        apiKey: "my-api-key",
        bearerToken: "my-jwt-token",
      });

      const headers = mockCreateClient.mock.calls[0][0].headers as Record<
        string,
        string
      >;
      expect(headers["Authorization"]).toBe("Bearer my-jwt-token");
      expect(headers["apikey"]).toBeUndefined();
    });
  });

  describe("createUpload", () => {
    it("calls POST /uploads and returns data", async () => {
      mockClient.POST.mockResolvedValue({
        data: { data: { id: "upload-1", presigned_url: "https://s3/upload" } },
        error: undefined,
        response: {},
      });

      const client = createNexusV3Client({
        baseUrl: "https://api.nexusmods.com/v3",
        apiKey: "key",
      });
      const result = await client.createUpload(1024, "file.zip");

      expect(mockClient.POST).toHaveBeenCalledWith("/uploads", {
        body: { size_bytes: 1024, filename: "file.zip" },
      });
      expect(result.id).toBe("upload-1");
      expect(result.presigned_url).toBe("https://s3/upload");
    });

    it("throws V3ApiError on error response", async () => {
      mockClient.POST.mockResolvedValue({
        data: undefined,
        error: {
          type: "about:blank",
          title: "Bad Request",
          status: 400,
          detail: "Invalid size",
          instance: "/uploads",
        },
        response: { status: 400, url: "https://api.nexusmods.com/v3/uploads" },
      });

      const client = createNexusV3Client({
        baseUrl: "https://api.nexusmods.com/v3",
        apiKey: "key",
      });

      await expect(client.createUpload(-1, "file.zip")).rejects.toThrow(
        V3ApiError,
      );
    });
  });

  describe("finaliseUpload", () => {
    it("calls POST /uploads/{id}/finalise", async () => {
      mockClient.POST.mockResolvedValue({
        data: { data: { id: "upload-1", state: "created" } },
        error: undefined,
        response: {},
      });

      const client = createNexusV3Client({
        baseUrl: "https://api.nexusmods.com/v3",
        apiKey: "key",
      });
      await client.finaliseUpload("upload-1");

      expect(mockClient.POST).toHaveBeenCalledWith("/uploads/{id}/finalise", {
        params: { path: { id: "upload-1" } },
      });
    });
  });

  describe("getUpload", () => {
    it("calls GET /uploads/{id} and returns state", async () => {
      mockClient.GET.mockResolvedValue({
        data: { data: { id: "upload-1", state: "available" } },
        error: undefined,
        response: {},
      });

      const client = createNexusV3Client({
        baseUrl: "https://api.nexusmods.com/v3",
        apiKey: "key",
      });
      const result = await client.getUpload("upload-1");

      expect(mockClient.GET).toHaveBeenCalledWith("/uploads/{id}", {
        params: { path: { id: "upload-1" } },
      });
      expect(result.state).toBe("available");
    });
  });

  describe("createCollection", () => {
    it("calls POST /collections with upload_id and payload", async () => {
      mockClient.POST.mockResolvedValue({
        data: { data: { id: "col-1", revision_id: "rev-1" } },
        error: undefined,
        response: {},
      });

      const client = createNexusV3Client({
        baseUrl: "https://api.nexusmods.com/v3",
        apiKey: "key",
      });
      const payload = {
        adult_content: false,
        collection_manifest: { info: {}, mods: [] },
        collection_schema_id: 1,
      };
      const result = await client.createCollection("upload-1", payload as any);

      expect(mockClient.POST).toHaveBeenCalledWith("/collections", {
        body: { upload_id: "upload-1", collection_data: payload },
      });
      expect(result.id).toBe("col-1");
      expect(result.revision_id).toBe("rev-1");
    });

    it("throws V3ApiError with validation errors on 422", async () => {
      mockClient.POST.mockResolvedValue({
        data: undefined,
        error: {
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
        },
        response: {
          status: 422,
          url: "https://api.nexusmods.com/v3/collections",
        },
      });

      const client = createNexusV3Client({
        baseUrl: "https://api.nexusmods.com/v3",
        apiKey: "key",
      });

      try {
        await client.createCollection("upload-1", {} as any);
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(V3ApiError);
        const v3err = err as V3ApiError;
        expect(v3err.status).toBe(422);
        expect(v3err.validationErrors).toHaveLength(1);
        expect(v3err.validationErrors![0].pointer).toContain("mod_id");
      }
    });
  });

  describe("createCollectionRevision", () => {
    it("calls POST /collections/{id}/revisions", async () => {
      mockClient.POST.mockResolvedValue({
        data: { data: { id: "rev-2", collection_id: "col-1" } },
        error: undefined,
        response: {},
      });

      const client = createNexusV3Client({
        baseUrl: "https://api.nexusmods.com/v3",
        apiKey: "key",
      });
      const result = await client.createCollectionRevision(
        "col-1",
        "upload-1",
        {} as any,
      );

      expect(mockClient.POST).toHaveBeenCalledWith(
        "/collections/{id}/revisions",
        {
          params: { path: { id: "col-1" } },
          body: { upload_id: "upload-1", collection_data: {} },
        },
      );
      expect(result.id).toBe("rev-2");
      expect(result.collection_id).toBe("col-1");
    });
  });
});
