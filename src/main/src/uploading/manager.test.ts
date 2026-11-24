import { VortexError } from "@vortex/shared";
import { AbortError } from "got";
import { assert, describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./s3Multipart", () => ({ uploadS3Multipart: vi.fn() }));

import { UploadManager } from "./manager";
import { uploadS3Multipart } from "./s3Multipart";

const mockUploadMultipart = vi.mocked(uploadS3Multipart);

const LAYOUT = {
  partSizeBytes: 4096,
  partPresignedUrls: ["https://s3.example.com/part1"],
  completePresignedUrl: "https://s3.example.com/complete",
};

const request = (uploadId: number, fileSize = 4096) => ({
  layout: LAYOUT,
  filePath: "/tmp/collection.7z",
  fileSize,
  uploadId,
  headers: {
    contentType: "application/octet-stream",
    contentDisposition: 'attachment; filename="collection.7z"',
  },
});

/** Holds the transfer open so the upload can be observed mid-flight. */
function pendingTransfer() {
  let settle!: (err?: Error) => void;
  let captured!: Parameters<typeof uploadS3Multipart>[3];
  mockUploadMultipart.mockImplementation(
    (_layout, _filePath, _fileSize, options) =>
      new Promise<void>((resolve, reject) => {
        captured = options;
        settle = (err) => (err === undefined ? resolve() : reject(err));
      }),
  );
  return {
    settle: () => settle,
    options: () => captured,
  };
}

describe("UploadManager", () => {
  let manager: UploadManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new UploadManager({ userAgent: "Vortex/1.2.3" });
    mockUploadMultipart.mockResolvedValue(undefined);
  });

  describe("progress", () => {
    it("reports zero bytes for an upload that has just started", async () => {
      const transfer = pendingTransfer();
      const promise = manager.uploadMultipart(request(1));

      expect(manager.getProgress(1)).toEqual({ transferred: 0, total: 4096 });

      transfer.settle()();
      await promise;
    });

    it("reports the bytes the transfer records", async () => {
      const transfer = pendingTransfer();
      const promise = manager.uploadMultipart(request(1));

      transfer.options()?.onProgress?.(1024);
      expect(manager.getProgress(1)).toEqual({ transferred: 1024, total: 4096 });

      transfer.settle()();
      await promise;
    });

    it("accepts a count lower than the last, as a retried transfer produces", async () => {
      const transfer = pendingTransfer();
      const promise = manager.uploadMultipart(request(1));

      transfer.options()?.onProgress?.(3000);
      transfer.options()?.onProgress?.(0);
      expect(manager.getProgress(1)?.transferred).toBe(0);

      transfer.settle()();
      await promise;
    });

    it("hands out a copy, so a later report cannot mutate a reading", async () => {
      const transfer = pendingTransfer();
      const promise = manager.uploadMultipart(request(1));

      const reading = manager.getProgress(1);
      transfer.options()?.onProgress?.(2048);

      expect(reading?.transferred).toBe(0);

      transfer.settle()();
      await promise;
    });

    it("reports nothing once the upload has settled", async () => {
      await manager.uploadMultipart(request(1));

      expect(manager.getProgress(1)).toBeUndefined();
    });

    it("reports nothing once a failed upload has settled", async () => {
      mockUploadMultipart.mockRejectedValue(new Error("Server returned 403"));

      await expect(manager.uploadMultipart(request(1))).rejects.toThrow();
      expect(manager.getProgress(1)).toBeUndefined();
    });
  });

  describe("cancellation", () => {
    it("aborts the signal the transfer is listening on", async () => {
      const transfer = pendingTransfer();
      const promise = manager.uploadMultipart(request(1));

      const { abortSignal } = transfer.options() ?? {};
      expect(abortSignal?.aborted).toBe(false);

      manager.cancel(1);
      expect(abortSignal?.aborted).toBe(true);

      // The real transport rejects once the request tears down.
      transfer.settle()(new AbortError({ options: {} } as never));
      await expect(promise).rejects.toThrow();
    });

    it("reports a canceled upload as such, not as a network failure", async () => {
      const transfer = pendingTransfer();
      const promise = manager.uploadMultipart(request(1));

      manager.cancel(1);
      transfer.settle()(new AbortError({ options: {} } as never));

      const err = await promise.catch((e: unknown) => e);
      assert(err instanceof VortexError && err.data.kind === "user-canceled");
    });

    it("leaves a genuine failure classified as it was", async () => {
      const failure = new VortexError("Server returned 403", {
        kind: "http:bad-status",
        url: "https://s3.example.com/upload",
        statusCode: 403,
      });
      mockUploadMultipart.mockRejectedValue(failure);

      await expect(manager.uploadMultipart(request(1))).rejects.toBe(failure);
    });

    it("ignores a cancel for an upload that is not running", () => {
      expect(() => manager.cancel(999)).not.toThrow();
    });
  });

  it("keeps concurrent uploads apart", async () => {
    const first = pendingTransfer();
    const promiseA = manager.uploadMultipart(request(1, 100));
    const optionsA = first.options();
    const settleA = first.settle();

    const second = pendingTransfer();
    const promiseB = manager.uploadMultipart(request(2, 200));

    optionsA?.onProgress?.(10);
    second.options()?.onProgress?.(20);

    expect(manager.getProgress(1)).toEqual({ transferred: 10, total: 100 });
    expect(manager.getProgress(2)).toEqual({ transferred: 20, total: 200 });

    // Cancelling one leaves the other running.
    manager.cancel(1);
    expect(optionsA?.abortSignal?.aborted).toBe(true);
    expect(second.options()?.abortSignal?.aborted).toBe(false);

    settleA(new AbortError({ options: {} } as never));
    second.settle()();
    await expect(promiseA).rejects.toThrow();
    await promiseB;
  });

  it("passes the user agent and signed headers to the transfer", async () => {
    await manager.uploadMultipart(request(1));

    expect(mockUploadMultipart).toHaveBeenCalledWith(
      LAYOUT,
      "/tmp/collection.7z",
      4096,
      expect.objectContaining({
        userAgent: "Vortex/1.2.3",
        headers: {
          contentType: "application/octet-stream",
          contentDisposition: 'attachment; filename="collection.7z"',
        },
      }),
    );
  });
});
