import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../logging", () => ({
  log: vi.fn(),
}));

import type { NexusV3Client } from "@vortex/nexus-api-v3";

import { uploadFile, uploadS3Multipart, pollUploadAvailable } from "./uploadV3";

function makeClient(overrides: Partial<NexusV3Client> = {}): NexusV3Client {
  return {
    getUpload: vi.fn(),
    ...overrides,
  } as unknown as NexusV3Client;
}

describe("pollUploadAvailable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("resolves immediately when state is available", async () => {
    const getUpload = vi.fn().mockResolvedValue({ state: "available" });
    const client = makeClient({ getUpload });

    await pollUploadAvailable(client, "upload-123");

    expect(getUpload).toHaveBeenCalledOnce();
    expect(getUpload).toHaveBeenCalledWith("upload-123");
  });

  it("polls until state becomes available", async () => {
    const getUpload = vi
      .fn()
      .mockResolvedValueOnce({ state: "created" })
      .mockResolvedValueOnce({ state: "created" })
      .mockResolvedValueOnce({ state: "available" });

    const client = makeClient({ getUpload });

    const promise = pollUploadAvailable(client, "upload-123");

    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(2000);

    await promise;

    expect(getUpload).toHaveBeenCalledTimes(3);
  });

  it("bails after tolerating unknown states a few times", async () => {
    const getUpload = vi.fn().mockResolvedValue({ state: "failed" });
    const client = makeClient({ getUpload });

    const promise = pollUploadAvailable(client, "upload-123");
    const settled = promise.catch((err: unknown) => err);
    await vi.runAllTimersAsync();
    const err = await settled;

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/unknown state/);
    // One initial observation + tolerance-1 more before bailing (3 total).
    expect(getUpload).toHaveBeenCalledTimes(3);
  });

  it("keeps polling through a single unknown-state blip", async () => {
    const getUpload = vi
      .fn()
      .mockResolvedValueOnce({ state: "created" })
      .mockResolvedValueOnce({ state: "mystery-new-state" })
      .mockResolvedValueOnce({ state: "created" })
      .mockResolvedValueOnce({ state: "available" });
    const client = makeClient({ getUpload });

    const promise = pollUploadAvailable(client, "upload-123");
    await vi.runAllTimersAsync();
    await promise;

    expect(getUpload).toHaveBeenCalledTimes(4);
  });
});

// The transfers themselves run in the main process; these cover the hand-off
// (see src/main/src/uploading for the retry/network behaviour).
describe("transfer hand-off to main", () => {
  type ProgressListener = (progress: {
    uploadId: number;
    transferred: number;
    total: number;
  }) => void;

  const file = vi.fn<(request: { fileSize: number; uploadId: number }) => Promise<void>>();
  const s3Multipart = vi.fn();
  const unsubscribe = vi.fn();
  let listeners: ProgressListener[];

  const onProgress = vi.fn((handler: ProgressListener) => {
    listeners.push(handler);
    return unsubscribe;
  });

  /** Pushes an event the way main would, to every current subscriber. */
  const emitProgress = (progress: { uploadId: number; transferred: number; total: number }) => {
    for (const listener of listeners) listener(progress);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    listeners = [];
    file.mockResolvedValue(undefined);
    s3Multipart.mockResolvedValue(undefined);
    (window as unknown as { api: unknown }).api = {
      uploader: { file, s3Multipart, onProgress },
    };
  });

  it("forwards a whole-file upload with a correlation id", async () => {
    await uploadFile("https://s3.example.com/upload", "/tmp/file.zip", 1024);

    expect(file).toHaveBeenCalledWith({
      url: "https://s3.example.com/upload",
      filePath: "/tmp/file.zip",
      fileSize: 1024,
      uploadId: expect.any(Number),
      headers: undefined,
    });
  });

  it("passes the signed headers through to main", async () => {
    const headers = {
      contentType: "application/octet-stream",
      contentDisposition: 'attachment; filename="collection_1.7z"',
    };

    await uploadFile("https://s3.example.com/upload", "/tmp/file.zip", 1024, { headers });

    expect(file).toHaveBeenCalledWith(expect.objectContaining({ headers }));
  });

  it("maps the v3 multipart layout onto the wire shape", async () => {
    await uploadS3Multipart(
      {
        part_size_bytes: 100,
        part_presigned_urls: ["https://s3.example.com/part1", "https://s3.example.com/part2"],
        complete_presigned_url: "https://s3.example.com/complete",
      },
      "/tmp/bigfile.zip",
      180,
    );

    expect(s3Multipart).toHaveBeenCalledWith({
      layout: {
        partSizeBytes: 100,
        partPresignedUrls: ["https://s3.example.com/part1", "https://s3.example.com/part2"],
        completePresignedUrl: "https://s3.example.com/complete",
      },
      filePath: "/tmp/bigfile.zip",
      fileSize: 180,
      uploadId: expect.any(Number),
      headers: undefined,
    });
  });

  it("propagates a failure from main", async () => {
    file.mockRejectedValue(new Error("Server returned 403"));

    await expect(uploadFile("https://s3.example.com/x", "/tmp/f.zip", 1)).rejects.toThrow(/403/);
  });

  it("forwards progress events for its own upload", async () => {
    const reported: Array<[number, number]> = [];
    file.mockImplementation(async ({ fileSize, uploadId }) => {
      emitProgress({ uploadId, transferred: 512, total: fileSize });
      emitProgress({ uploadId, transferred: fileSize, total: fileSize });
    });

    await uploadFile("https://s3.example.com/upload", "/tmp/file.zip", 1024, {
      onProgress: (transferred, total) => reported.push([transferred, total]),
    });

    expect(reported).toEqual([
      [512, 1024],
      [1024, 1024],
    ]);
  });

  it("ignores progress belonging to another upload", async () => {
    const reported: Array<[number, number]> = [];
    file.mockImplementation(async ({ fileSize, uploadId }) => {
      emitProgress({ uploadId: uploadId + 1000, transferred: 1, total: fileSize });
      emitProgress({ uploadId, transferred: 2, total: fileSize });
    });

    await uploadFile("https://s3.example.com/upload", "/tmp/file.zip", 10, {
      onProgress: (transferred, total) => reported.push([transferred, total]),
    });

    expect(reported).toEqual([[2, 10]]);
  });

  it("drops the subscription once the upload settles, including on failure", async () => {
    await uploadFile("https://s3.example.com/upload", "/tmp/file.zip", 1, {
      onProgress: () => {},
    });
    expect(unsubscribe).toHaveBeenCalledOnce();

    file.mockRejectedValue(new Error("Server returned 500"));
    await expect(
      uploadFile("https://s3.example.com/upload", "/tmp/file.zip", 1, { onProgress: () => {} }),
    ).rejects.toThrow();
    expect(unsubscribe).toHaveBeenCalledTimes(2);
  });

  it("does not subscribe when no progress handler is given", async () => {
    await uploadFile("https://s3.example.com/upload", "/tmp/file.zip", 1);

    expect(onProgress).not.toHaveBeenCalled();
  });
});
