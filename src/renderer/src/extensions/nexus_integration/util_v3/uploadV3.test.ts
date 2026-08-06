import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../logging", () => ({
  log: vi.fn(),
}));

import type { NexusV3Client } from "@vortex/nexus-api-v3";
import type { WireUploadProgress } from "@vortex/shared/ipc";

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
  const file = vi.fn<(request: { fileSize: number; uploadId: number }) => Promise<void>>();
  const s3Multipart = vi.fn();
  const getProgress = vi.fn<(uploadId: number) => Promise<WireUploadProgress | null>>();
  const cancel = vi.fn<(uploadId: number) => Promise<void>>();

  /** One poll tick, matching the interval `withProgress` waits. */
  const POLL_TICK = 200;

  /** Holds the upload open so poll ticks can be driven deliberately. */
  function pendingUpload() {
    let settle!: (err?: Error) => void;
    file.mockImplementation(
      () =>
        new Promise<void>((resolve, reject) => {
          settle = (err) => (err === undefined ? resolve() : reject(err));
        }),
    );
    return () => settle;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    file.mockResolvedValue(undefined);
    s3Multipart.mockResolvedValue(undefined);
    getProgress.mockResolvedValue(null);
    cancel.mockResolvedValue(undefined);
    (window as unknown as { api: unknown }).api = {
      uploader: { file, s3Multipart, getProgress, cancel },
    };
  });

  afterEach(() => vi.useRealTimers());

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

  it("polls main for progress while the transfer runs", async () => {
    const reported: Array<[number, number]> = [];
    getProgress
      .mockResolvedValueOnce({ transferred: 512, total: 1024 })
      .mockResolvedValueOnce({ transferred: 1024, total: 1024 });
    const settle = pendingUpload();

    const promise = uploadFile("https://s3.example.com/upload", "/tmp/file.zip", 1024, {
      onProgress: (transferred, total) => reported.push([transferred, total]),
    });

    await vi.advanceTimersByTimeAsync(POLL_TICK);
    await vi.advanceTimersByTimeAsync(POLL_TICK);
    settle()();
    await promise;

    expect(reported).toEqual([
      [512, 1024],
      [1024, 1024],
    ]);
  });

  it("polls for its own upload id", async () => {
    const settle = pendingUpload();

    const promise = uploadFile("https://s3.example.com/upload", "/tmp/file.zip", 1024, {
      onProgress: () => {},
    });
    await vi.advanceTimersByTimeAsync(POLL_TICK);
    settle()();
    await promise;

    const { uploadId } = file.mock.calls[0]![0];
    expect(getProgress).toHaveBeenCalledWith(uploadId);
  });

  it("reports nothing for a poll that finds the upload already settled", async () => {
    const reported: Array<[number, number]> = [];
    getProgress.mockResolvedValue(null);
    const settle = pendingUpload();

    const promise = uploadFile("https://s3.example.com/upload", "/tmp/file.zip", 1024, {
      onProgress: (transferred, total) => reported.push([transferred, total]),
    });
    await vi.advanceTimersByTimeAsync(POLL_TICK);
    settle()();
    await promise;

    expect(reported).toEqual([]);
  });

  it("stops polling once the upload settles, including on failure", async () => {
    file.mockRejectedValue(new Error("Server returned 500"));

    await expect(
      uploadFile("https://s3.example.com/upload", "/tmp/file.zip", 1, { onProgress: () => {} }),
    ).rejects.toThrow();

    const callsAtSettle = getProgress.mock.calls.length;
    await vi.advanceTimersByTimeAsync(POLL_TICK * 5);
    expect(getProgress).toHaveBeenCalledTimes(callsAtSettle);
  });

  it("survives a failed progress query", async () => {
    getProgress.mockRejectedValue(new Error("channel closed"));
    const settle = pendingUpload();

    const promise = uploadFile("https://s3.example.com/upload", "/tmp/file.zip", 1, {
      onProgress: () => {},
    });
    await vi.advanceTimersByTimeAsync(POLL_TICK);
    settle()();

    await expect(promise).resolves.toBeUndefined();
  });

  it("asks main to cancel when the caller's signal aborts", async () => {
    const controller = new AbortController();
    const settle = pendingUpload();

    const promise = uploadFile("https://s3.example.com/upload", "/tmp/file.zip", 1024, {
      abortSignal: controller.signal,
    });
    controller.abort();

    const { uploadId } = file.mock.calls[0]![0];
    expect(cancel).toHaveBeenCalledWith(uploadId);

    // Main rejects the transfer once it tears the request down.
    settle()(new Error("Upload canceled"));
    await expect(promise).rejects.toThrow(/canceled/);
  });

  it("cancels immediately when handed a signal that has already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const settle = pendingUpload();

    const promise = uploadFile("https://s3.example.com/upload", "/tmp/file.zip", 1024, {
      abortSignal: controller.signal,
    });

    expect(cancel).toHaveBeenCalledTimes(1);
    settle()(new Error("Upload canceled"));
    await expect(promise).rejects.toThrow();
  });

  it("stops listening to the signal once the upload settles", async () => {
    const controller = new AbortController();

    await uploadFile("https://s3.example.com/upload", "/tmp/file.zip", 1024, {
      abortSignal: controller.signal,
    });
    controller.abort();

    // Aborting after the fact must not cancel some later upload.
    expect(cancel).not.toHaveBeenCalled();
  });

  it("does not poll when no progress handler is given", async () => {
    const settle = pendingUpload();

    const promise = uploadFile("https://s3.example.com/upload", "/tmp/file.zip", 1);
    await vi.advanceTimersByTimeAsync(POLL_TICK * 3);
    settle()();
    await promise;

    expect(getProgress).not.toHaveBeenCalled();
  });
});
