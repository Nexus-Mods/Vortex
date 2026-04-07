import type Nexus from "@nexusmods/nexus-api";
import type {
  ICollection,
  ICollectionManifest,
} from "@nexusmods/nexus-api";
import type { NexusV3Client } from "@vortex/nexus-api-v3";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../util/log", () => ({
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

vi.mock("../guards", () => ({
  hasConfidentialWithNexus: vi.fn(() => true),
}));

vi.mock("../selectors", () => ({
  apiKey: vi.fn(() => "test-api-key"),
}));

import { createNexusV3Client } from "@vortex/nexus-api-v3";
import { stat } from "fs-extra";

import type { IState } from "../../../types/IState";

import { hasConfidentialWithNexus } from "../guards";
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

interface MockCollection {
  id: number;
  slug: string;
  currentRevision?: { id: number; revisionNumber: number; status: string };
}

function makeGetMyCollections(collections: MockCollection[]) {
  return vi
    .fn<Nexus["getMyCollections"]>()
    .mockResolvedValue(
      collections as unknown as Array<Partial<ICollection>>,
    );
}

function makeNexus(collections: MockCollection[] = []): Nexus {
  return {
    getMyCollections: makeGetMyCollections(collections),
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
        user_id: "1",
        state: "created",
      }),
    createMultipartUpload: vi
      .fn<NexusV3Client["createMultipartUpload"]>()
      .mockResolvedValue({
        id: "upload-456",
        parts_size: 100 * 1024 * 1024,
        parts_presigned_url: [
          "https://s3.example.com/part1",
          "https://s3.example.com/part2",
        ],
        complete_presigned_url: "https://s3.example.com/complete",
        user_id: "1",
        state: "created",
      }),
    finaliseUpload: vi
      .fn<NexusV3Client["finaliseUpload"]>()
      .mockResolvedValue({ id: "upload-123", user_id: "1", state: "created" }),
    getUpload: vi
      .fn<NexusV3Client["getUpload"]>()
      .mockResolvedValue({
        id: "upload-123",
        user_id: "1",
        state: "available",
      }),
    createCollection: vi
      .fn<NexusV3Client["createCollection"]>()
      .mockResolvedValue({ id: "999", revision_id: "rev-1" }),
    createCollectionRevision: vi
      .fn<NexusV3Client["createCollectionRevision"]>()
      .mockResolvedValue({ id: "rev-2", collection_id: "888" }),
  };
}

describe("submitCollectionV3", () => {
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = makeMockClient();
    mockCreateClient.mockReturnValue(mockClient as NexusV3Client);
    mockStat.mockResolvedValue({ size: SMALL_FILE_SIZE });
  });

  describe("upload path selection", () => {
    it("uses single-part upload for small files", async () => {
      mockStat.mockResolvedValue({ size: SMALL_FILE_SIZE });
      const nexus = makeNexus([
        {
          id: 999,
          slug: "test",
          currentRevision: { id: 1, revisionNumber: 0, status: "draft" },
        },
      ]);

      await submitCollectionV3(
        makeState(),
        nexus,
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
      const nexus = makeNexus([
        {
          id: 999,
          slug: "test",
          currentRevision: { id: 1, revisionNumber: 0, status: "draft" },
        },
      ]);

      await submitCollectionV3(
        makeState(),
        nexus,
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

  describe("collection creation", () => {
    it("creates a new collection when collectionId is undefined", async () => {
      const nexus = makeNexus([
        {
          id: 999,
          slug: "test-slug",
          currentRevision: { id: 1, revisionNumber: 0, status: "draft" },
        },
      ]);

      const result = await submitCollectionV3(
        makeState(),
        nexus,
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
    });

    it("creates a revision when collectionId is provided", async () => {
      const nexus = makeNexus([
        {
          id: 888,
          slug: "existing-slug",
          currentRevision: {
            id: 2,
            revisionNumber: 1,
            status: "under_moderation",
          },
        },
      ]);

      const result = await submitCollectionV3(
        makeState(),
        nexus,
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
      expect(result.collection?.slug).toBe("existing-slug");
    });
  });

  describe("fetchCollectionDetails", () => {
    it("returns slug and revision details from GraphQL", async () => {
      const collections = [
        {
          id: 999,
          slug: "my-collection",
          currentRevision: {
            id: 42,
            revisionNumber: 3,
            status: "published",
          },
        },
      ];
      const getMyCollections = makeGetMyCollections(collections);
      const nexus = { getMyCollections } as unknown as Nexus;

      const result = await submitCollectionV3(
        makeState(),
        nexus,
        makeManifest(),
        "/tmp/file.zip",
        undefined,
      );

      expect(getMyCollections).toHaveBeenCalled();
      expect(result.collection?.slug).toBe("my-collection");
      expect(result.revision?.id).toBe(42);
      expect(result.revision?.revisionNumber).toBe(3);
      expect(result.revision?.revisionStatus).toBe("published");
    });

    it("returns partial result when collection not found in GraphQL", async () => {
      const nexus = makeNexus([]); // empty — collection not found

      const result = await submitCollectionV3(
        makeState(),
        nexus,
        makeManifest(),
        "/tmp/file.zip",
        undefined,
      );

      expect(result.success).toBe(true);
      expect(result.collection?.id).toBe(999);
      expect(result.collection?.slug).toBeUndefined();
      expect(result.revision).toBeUndefined();
    });

    it("handles collection with no currentRevision", async () => {
      const nexus = makeNexus([
        { id: 999, slug: "test", currentRevision: undefined },
      ]);

      const result = await submitCollectionV3(
        makeState(),
        nexus,
        makeManifest(),
        "/tmp/file.zip",
        undefined,
      );

      expect(result.collection?.slug).toBe("test");
      expect(result.revision).toBeUndefined();
    });
  });

  describe("upload lifecycle", () => {
    it("calls finalise and poll after upload", async () => {
      const nexus = makeNexus([
        {
          id: 999,
          slug: "test",
          currentRevision: { id: 1, revisionNumber: 0, status: "draft" },
        },
      ]);

      await submitCollectionV3(
        makeState(),
        nexus,
        makeManifest(),
        "/tmp/file.zip",
        undefined,
      );

      expect(mockClient.finaliseUpload).toHaveBeenCalledWith("upload-123");
    });
  });

  describe("auth", () => {
    it("throws when not logged in", async () => {
      vi.mocked(hasConfidentialWithNexus).mockReturnValueOnce(false);

      await expect(
        submitCollectionV3(
          makeState(),
          makeNexus(),
          makeManifest(),
          "/tmp/file.zip",
          undefined,
        ),
      ).rejects.toThrow("Not logged in");
    });
  });
});
