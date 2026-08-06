import type { components, NexusV3Client } from "@vortex/nexus-api-v3";
import type { WireUploadHeaders } from "@vortex/shared/ipc";

import { log } from "../../../logging";

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 150; // 5 minutes

type UploadState = components["schemas"]["UploadState"];

// States declared by the OpenAPI schema. A successful upload transitions
// created → available. Exhaustive by construction: a schema regen that adds a
// state fails to compile here, forcing it to be classified.
const STATE_DISPOSITION: Record<UploadState, "inprogress" | "success"> = {
  created: "inprogress",
  available: "success",
};
const UNKNOWN_STATE_TOLERANCE = 3;

// Defensive lookup: the live server can be newer than the vendored schema,
// so the reported state may fall outside UploadState at runtime.
function dispositionOf(state: string): "inprogress" | "success" | undefined {
  return STATE_DISPOSITION[state as UploadState];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function pollUploadAvailable(client: NexusV3Client, uploadId: string): Promise<void> {
  let unknownStreak = 0;
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    const upload = await client.getUpload(uploadId);
    const { state } = upload;
    const disposition = dispositionOf(state);
    if (disposition === "success") {
      return;
    }
    if (disposition === "inprogress") {
      unknownStreak = 0;
      log("debug", "polling upload status", {
        uploadId,
        state,
        attempt,
      });
    } else {
      unknownStreak += 1;
      log("warn", "upload reported unknown state", {
        uploadId,
        state,
        attempt,
        unknownStreak,
        tolerance: UNKNOWN_STATE_TOLERANCE,
      });
      if (unknownStreak >= UNKNOWN_STATE_TOLERANCE) {
        throw new Error(
          `Upload ${uploadId} reported unknown state "${state}" ${unknownStreak} times; bailing`,
        );
      }
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(
    `Upload ${uploadId} did not become available within ${(POLL_INTERVAL_MS * POLL_MAX_ATTEMPTS) / 1000}s`,
  );
}

/** Reports bytes sent out of the total for the file being uploaded. */
export type UploadProgressHandler = (transferred: number, total: number) => void;

export type UploadOptions = {
  /**
   * Headers the presigned URL's signature covers. Build them with
   * `uploadHeadersFor` from `@vortex/nexus-api-v3`, which knows what the v3
   * upload session was signed with.
   */
  headers?: WireUploadHeaders;
  onProgress?: UploadProgressHandler;
  /**
   * Aborting stops the transfer in main; the returned promise rejects with an
   * `UploadError` carrying `cancellation`. A signal is used rather than the
   * upload id because a signal cannot cross the IPC boundary — this maps one
   * onto the other.
   */
  abortSignal?: AbortSignal;
};

let nextUploadId = 0;

/** How often to ask main how far the transfer has got, in milliseconds. */
const PROGRESS_POLL_INTERVAL_MS = 200;

/**
 * Runs an upload in main, polling it for progress while it runs.
 *
 * Pull rather than push, matching the downloader: main keeps the byte count and
 * the renderer reads it at a cadence that suits the UI, so the transfer never
 * pays for reporting and a busy renderer cannot fall behind a queue of events.
 * The id identifies this transfer among any others in flight.
 */
async function withProgress(
  options: UploadOptions | undefined,
  run: (uploadId: number) => Promise<void>,
): Promise<void> {
  const uploadId = nextUploadId++;
  const { onProgress, abortSignal } = options ?? {};

  // The signal is local to this process; cancelling the transfer means telling
  // main, which holds the AbortController the request actually listens to.
  const requestCancel = () => {
    void window.api.uploader.cancel(uploadId);
  };
  if (abortSignal?.aborted === true) requestCancel();
  abortSignal?.addEventListener("abort", requestCancel);

  const stopWatchingAbort = () => abortSignal?.removeEventListener("abort", requestCancel);

  if (onProgress === undefined) {
    try {
      await run(uploadId);
    } finally {
      stopWatchingAbort();
    }
    return;
  }

  let polling = true;
  let wakeEarly: (() => void) | undefined;

  const pollUntilDone = async () => {
    while (polling) {
      // Interruptible, so settling the upload does not have to wait out a full
      // interval before the loop can exit.
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, PROGRESS_POLL_INTERVAL_MS);
        wakeEarly = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      wakeEarly = undefined;
      if (!polling) return;

      try {
        const progress = await window.api.uploader.getProgress(uploadId);
        // Null once main has dropped the entry, which the run promise follows.
        if (progress !== null) onProgress(progress.transferred, progress.total);
      } catch {
        // A dropped sample is not worth failing the upload over.
      }
    }
  };

  const polled = pollUntilDone();
  try {
    await run(uploadId);
  } finally {
    polling = false;
    wakeEarly?.();
    stopWatchingAbort();
    await polled;
  }
}

/**
 * The byte transfers run in the main process (see `src/main/src/uploading`),
 * which owns the got-based network stack and the shared retry strategy. The
 * renderer only holds the authenticated v3 session, so it drives the API calls
 * either side of the transfer.
 */
export function uploadFile(
  url: string,
  filePath: string,
  fileSize: number,
  options?: UploadOptions,
): Promise<void> {
  return withProgress(options, (uploadId) =>
    window.api.uploader.file({
      url,
      filePath,
      fileSize,
      uploadId,
      headers: options?.headers,
    }),
  );
}

/**
 * `/uploads/multipart` sessions are defined against the Amazon S3 multipart
 * specification, so the transfer follows that protocol in main. This only
 * restates the session layout in the wire shape.
 */
export function uploadS3Multipart(
  layout: {
    part_size_bytes: number;
    part_presigned_urls: ArrayLike<string>;
    complete_presigned_url: string;
  },
  filePath: string,
  fileSize: number,
  options?: UploadOptions,
): Promise<void> {
  const wireLayout = {
    partSizeBytes: layout.part_size_bytes,
    partPresignedUrls: Array.from(layout.part_presigned_urls),
    completePresignedUrl: layout.complete_presigned_url,
  };
  return withProgress(options, (uploadId) =>
    window.api.uploader.s3Multipart({
      layout: wireLayout,
      filePath,
      fileSize,
      uploadId,
      headers: options?.headers,
    }),
  );
}
