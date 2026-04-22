import type { ICollectionManifest, default as Nexus } from "@nexusmods/nexus-api";
import type { NexusV3Client } from "@vortex/nexus-api-v3";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../logging", () => ({
  log: vi.fn(),
}));

vi.mock("@vortex/nexus-api-v3", () => ({
  createNexusV3Client: vi.fn(),
}));

vi.mock("fs-extra", () => ({
  default: { stat: vi.fn() },
  stat: vi.fn(),
}));

vi.mock("./uploadV3", () => ({
  pollUploadAvailable: vi.fn().mockResolvedValue(undefined),
  uploadSinglePart: vi.fn().mockResolvedValue(undefined),
  uploadMultipart: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./manifestMapping", () => ({
  toV3CollectionPayload: vi.fn(() => ({
    adult_content: false,
    collection_manifest: {},
    collection_schema_id: 1,
  })),
}));

vi.mock("../selectors", () => ({
  apiKey: vi.fn(() => "test-api-key"),
  isLoggedIn: vi.fn(() => true),
}));

import { createNexusV3Client } from "@vortex/nexus-api-v3";
import { stat } from "fs-extra";

import type { IState } from "../../../types/IState";

import { isLoggedIn } from "../selectors";
import { submitCollectionV3 } from "./submitCollectionV3";
import { uploadMultipart, uploadSinglePart } from "./uploadV3";

const mockCreateClient = vi.mocked(createNexusV3Client);
const mockStat = stat as unknown as ReturnType<typeof vi.fn>;

const SMALL_FILE_SIZE = 1024; // < 100 MiB
const LARGE_FILE_SIZE = 200 * 1024 * 1024; // > 100 MiB

function makeState(): IState {
  return {
    confidential: {
      account: {
        nexus: {
          APIKey: "test-key",
          OAuthCredentials: { token: "test-token" },
        },
      },
    },
  } as unknown as IState;
}

function makeManifest(): ICollectionManifest {
  return {
    info: {
      author: "Author",
      name: "Test",
      domainName: "skyrim",
    },
    mods: [],
  };
}

function makeNexus(): Nexus {
  return {
    editCollection: vi.fn().mockResolvedValue(true),
  } as unknown as Nexus;
}

function makeMockClient(): Pick<
  NexusV3Client,
  | "createUpload"
  | "createMultipartUpload"
  | "finaliseUpload"
  | "getUpload"
  | "createCollection"
  | "createCollectionRevision"
> {
  return {
    createUpload: vi
      .fn<NexusV3Client["createUpload"]>()
      .mockResolvedValue({
        id: "upload-123",
        presigned_url: "https://s3.example.com/upload",
        user: { id: "1" },
        state: "created",
      }),
    createMultipartUpload: vi
      .fn<NexusV3Client["createMultipartUpload"]>()
      .mockResolvedValue({
        id: "upload-456",
        part_size_bytes: 100 * 1024 * 1024,
        part_presigned_urls: [
          "https://s3.example.com/part1",
          "https://s3.example.com/part2",
        ],
        complete_presigned_url: "https://s3.example.com/complete",
        user: { id: "1" },
        state: "created",
      }),
    finaliseUpload: vi
      .fn<NexusV3Client["finaliseUpload"]>()
      .mockResolvedValue({ id: "upload-123", user: { id: "1" }, state: "created" }),
    getUpload: vi
      .fn<NexusV3Client["getUpload"]>()
      .mockResolvedValue({
        id: "upload-123",
        user: { id: "1" },
        state: "available",
      }),
    createCollection: vi
      .fn<NexusV3Client["createCollection"]>()
      .mockResolvedValue({
        id: "999",
        slug: "test-slug",
        revision_id: "1",
        revision_number: 1,
        revision_status: "draft",
      }),
    createCollectionRevision: vi
      .fn<NexusV3Client["createCollectionRevision"]>()
      .mockResolvedValue({
        id: "42",
        collection_id: "888",
        revision_number: 2,
        revision_status: "draft",
      }),
  };
}

describe("submitCollectionV3", () => {
  let mockClient: ReturnType<typeof makeMockClient>;
  let mockNexus: Nexus;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = makeMockClient();
    mockNexus = makeNexus();
    mockCreateClient.mockReturnValue(mockClient as NexusV3Client);
    mockStat.mockResolvedValue({ size: SMALL_FILE_SIZE });
  });

  describe("upload path selection", () => {
    it("uses single-part upload for small files", async () => {
      mockStat.mockResolvedValue({ size: SMALL_FILE_SIZE });

      await submitCollectionV3(
        makeState(),
        mockNexus,
        makeManifest(),
        "/tmp/small.zip",
        undefined,
      );

      expect(mockClient.createUpload).toHaveBeenCalledWith(
        SMALL_FILE_SIZE,
        "small.zip",
      );
      expect(vi.mocked(uploadSinglePart)).toHaveBeenCalled();
      expect(mockClient.createMultipartUpload).not.toHaveBeenCalled();
      expect(vi.mocked(uploadMultipart)).not.toHaveBeenCalled();
    });

    it("uses multipart upload for large files", async () => {
      mockStat.mockResolvedValue({ size: LARGE_FILE_SIZE });

      await submitCollectionV3(
        makeState(),
        mockNexus,
        makeManifest(),
        "/tmp/large.zip",
        undefined,
      );

      expect(mockClient.createMultipartUpload).toHaveBeenCalledWith(
        LARGE_FILE_SIZE,
        "large.zip",
      );
      expect(vi.mocked(uploadMultipart)).toHaveBeenCalled();
      expect(mockClient.createUpload).not.toHaveBeenCalled();
      expect(vi.mocked(uploadSinglePart)).not.toHaveBeenCalled();
    });
  });

  describe("new collection", () => {
    it("returns id, slug, revisionNumber, and revisionStatus from V3 response", async () => {
      const result = await submitCollectionV3(
        makeState(),
        mockNexus,
        makeManifest(),
        "/tmp/file.zip",
        undefined,
      );

      expect(mockClient.createCollection).toHaveBeenCalledWith(
        "upload-123",
        expect.any(Object),
      );
      expect(mockClient.createCollectionRevision).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.collection?.id).toBe(999);
      expect(result.collection?.slug).toBe("test-slug");
      expect(result.revision?.id).toBe(1);
      expect(result.revision?.revisionNumber).toBe(1);
      expect(result.revision?.revisionStatus).toBe("draft");
    });
  });

  describe("revision update", () => {
    it("returns id, revisionNumber, and revisionStatus from V3 response (slug unchanged)", async () => {
      const result = await submitCollectionV3(
        makeState(),
        mockNexus,
        makeManifest(),
        "/tmp/file.zip",
        888,
      );

      expect(mockClient.createCollectionRevision).toHaveBeenCalledWith(
        "888",
        "upload-123",
        expect.any(Object),
      );
      expect(mockClient.createCollection).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.collection?.id).toBe(888);
      // slug intentionally not returned — caller keeps previously stored value
      expect(result.collection?.slug).toBeUndefined();
      expect(result.revision?.id).toBe(42);
      expect(result.revision?.revisionNumber).toBe(2);
      expect(result.revision?.revisionStatus).toBe("draft");
    });

    it("calls nexus.editCollection with the current name before the revision upload", async () => {
      await submitCollectionV3(
        makeState(),
        mockNexus,
        makeManifest(),
        "/tmp/file.zip",
        888,
      );

      expect(mockNexus.editCollection).toHaveBeenCalledWith(888, "Test");
      const editOrder = vi.mocked(mockNexus.editCollection).mock
        .invocationCallOrder[0];
      const revisionOrder = vi.mocked(mockClient.createCollectionRevision).mock
        .invocationCallOrder[0];
      expect(editOrder).toBeLessThan(revisionOrder);
    });

    it("does not call nexus.editCollection when creating a new collection", async () => {
      await submitCollectionV3(
        makeState(),
        mockNexus,
        makeManifest(),
        "/tmp/file.zip",
        undefined,
      );

      expect(mockNexus.editCollection).not.toHaveBeenCalled();
    });
  });

  describe("upload lifecycle", () => {
    it("calls finalise and poll after upload", async () => {
      await submitCollectionV3(
        makeState(),
        mockNexus,
        makeManifest(),
        "/tmp/file.zip",
        undefined,
      );

      expect(mockClient.finaliseUpload).toHaveBeenCalledWith("upload-123");
    });
  });

  describe("auth", () => {
    it("throws when not logged in", async () => {
      vi.mocked(isLoggedIn).mockReturnValueOnce(false);

      await expect(
        submitCollectionV3(
          makeState(),
          makeManifest(),
          "/tmp/file.zip",
          undefined,
        ),
      ).rejects.toThrow("Not logged in");
    });
  });
});
