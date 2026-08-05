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
};

let nextUploadId = 0;

/**
 * Runs an upload in main and pumps its progress events into `onProgress` for
 * the duration of the call. The id keeps this transfer's events apart from any
 * other upload's, and the subscription is dropped as soon as it settles.
 */
async function withProgress(
  onProgress: UploadProgressHandler | undefined,
  run: (uploadId: number) => Promise<void>,
): Promise<void> {
  const uploadId = nextUploadId++;
  if (onProgress === undefined) {
    await run(uploadId);
    return;
  }

  const unsubscribe = window.api.uploader.onProgress((progress) => {
    if (progress.uploadId !== uploadId) return;
    onProgress(progress.transferred, progress.total);
  });
  try {
    await run(uploadId);
  } finally {
    unsubscribe();
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
  return withProgress(options?.onProgress, (uploadId) =>
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
  return withProgress(options?.onProgress, (uploadId) =>
    window.api.uploader.s3Multipart({
      layout: wireLayout,
      filePath,
      fileSize,
      uploadId,
      headers: options?.headers,
    }),
  );
}
