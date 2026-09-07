import { VortexError } from "@vortex/shared";
import type { WireS3MultipartRequest, WireUploadRequest } from "@vortex/shared/ipc";

import { isCancellation } from "../transfer/cancellation";
import { uploadS3Multipart } from "./s3Multipart";
import type { UploadHeaders } from "./transport";
import { uploadFile } from "./transport";

export type UploadProgress = {
  transferred: number;
  total: number;
};

export interface UploadManagerOptions {
  /** User-Agent for the storage requests, e.g. `Vortex/1.2.3`. */
  userAgent?: string;
}

type InFlightUpload = {
  progress: UploadProgress;
  abort: AbortController;
};

/**
 * Owns the uploads running in this process: their byte counts, so the renderer
 * can poll rather than be pushed every update, and their abort handles, so one
 * can be stopped once started.
 */
export class UploadManager {
  readonly #userAgent: string | undefined;
  readonly #uploads = new Map<number, InFlightUpload>();

  constructor(options: UploadManagerOptions = {}) {
    this.#userAgent = options.userAgent;
  }

  /** PUTs the whole file to a single URL. Rejects if canceled. */
  async upload(request: WireUploadRequest): Promise<void> {
    const { url, filePath, fileSize, uploadId, headers } = request;
    await this.#run(uploadId, fileSize, headers, (options) =>
      uploadFile(url, filePath, fileSize, options),
    );
  }

  /** Uploads the file as S3 multipart parts. Rejects if canceled. */
  async uploadMultipart(request: WireS3MultipartRequest): Promise<void> {
    const { layout, filePath, fileSize, uploadId, headers } = request;
    await this.#run(uploadId, fileSize, headers, (options) =>
      uploadS3Multipart(layout, filePath, fileSize, options),
    );
  }

  /**
   * Stops a running upload. The call that started it rejects with a
   * `VortexError` carrying `kind: "user-canceled"`. Unknown ids are ignored:
   * an upload that has already settled is nothing to cancel.
   */
  cancel(uploadId: number): void {
    this.#uploads.get(uploadId)?.abort.abort();
  }

  /** Current progress, or undefined once the upload is no longer running. */
  getProgress(uploadId: number): UploadProgress | undefined {
    const upload = this.#uploads.get(uploadId);
    // A copy: a reading must not change under the caller on the next write.
    return upload === undefined ? undefined : { ...upload.progress };
  }

  async #run(
    uploadId: number,
    total: number,
    headers: UploadHeaders | undefined,
    transfer: (options: {
      userAgent: string | undefined;
      headers: UploadHeaders | undefined;
      abortSignal: AbortSignal;
      onProgress: (transferred: number) => void;
    }) => Promise<void>,
  ): Promise<void> {
    const entry: InFlightUpload = {
      progress: { transferred: 0, total },
      abort: new AbortController(),
    };
    this.#uploads.set(uploadId, entry);

    try {
      await transfer({
        userAgent: this.#userAgent,
        headers,
        abortSignal: entry.abort.signal,
        onProgress: (transferred) => {
          // Not monotonic: a retried request restarts its body, and a multipart
          // upload rewinds to the start of the part being retried.
          entry.progress.transferred = transferred;
        },
      });
    } catch (err) {
      if (isCancellation(err)) {
        throw new VortexError(
          "Upload canceled",
          { kind: "user-canceled", skipped: false },
          { cause: err },
        );
      }
      throw err;
    } finally {
      this.#uploads.delete(uploadId);
    }
  }
}
