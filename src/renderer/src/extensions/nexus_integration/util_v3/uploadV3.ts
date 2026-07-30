import { createReadStream } from "fs";

import type { components, NexusV3Client } from "@vortex/nexus-api-v3";
import { getErrorMessageOrDefault } from "@vortex/shared";

import { log } from "../../../logging";
import { HttpUploadError, uploadWithHeaders, type IUploadResult } from "../../../util/network";

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 150; // 5 minutes

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;

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

function statusCodeOf(err: unknown): number | undefined {
  return err instanceof HttpUploadError ? err.statusCode : undefined;
}

function isRetryableError(err: unknown): boolean {
  const sc = statusCodeOf(err);
  if (sc === undefined) {
    // No HTTP status — treat as transport error, retry.
    return true;
  }
  // 4xx are client errors and generally not worth retrying. 408 (timeout)
  // and 429 (rate-limit) are the conventional exceptions.
  if (sc >= 400 && sc < 500 && sc !== 408 && sc !== 429) {
    return false;
  }
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  attempts: number = RETRY_ATTEMPTS,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === attempts || !isRetryableError(err)) {
        if (!isRetryableError(err)) {
          log("debug", "upload attempt failed, not retrying", {
            label,
            statusCode: statusCodeOf(err),
            error: getErrorMessageOrDefault(err),
          });
        }
        break;
      }
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      log("warn", "upload attempt failed, retrying", {
        label,
        attempt,
        attempts,
        delayMs: delay,
        error: getErrorMessageOrDefault(err),
      });
      await sleep(delay);
    }
  }
  throw lastErr;
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

export async function uploadSinglePart(
  presignedUrl: string,
  filePath: string,
  fileSize: number,
): Promise<void> {
  await withRetry<IUploadResult>(
    () => uploadWithHeaders(presignedUrl, createReadStream(filePath), fileSize),
    "single-part upload",
  );
}

function buildCompleteMultipartXml(etags: Array<{ partNumber: number; etag: string }>): string {
  const parts = etags
    .map(
      ({ partNumber, etag }) =>
        `  <Part>\n    <PartNumber>${partNumber}</PartNumber>\n    <ETag>${etag}</ETag>\n  </Part>`,
    )
    .join("\n");
  return `<CompleteMultipartUpload>\n${parts}\n</CompleteMultipartUpload>`;
}

async function uploadPart(
  url: string,
  filePath: string,
  start: number,
  end: number,
  partNumber: number,
  totalParts: number,
): Promise<{ partNumber: number; etag: string }> {
  const chunkSize = end - start;
  const result = await withRetry<IUploadResult>(() => {
    const stream = createReadStream(filePath, { start, end: end - 1 });
    return uploadWithHeaders(url, stream, chunkSize);
  }, `multipart part ${partNumber}/${totalParts}`);

  const etag = result.headers.etag;
  if (!etag) {
    throw new Error(`S3 did not return an ETag for part ${partNumber} of multipart upload`);
  }

  log("debug", "multipart part uploaded", {
    part: partNumber,
    total: totalParts,
    etag,
  });
  return { partNumber, etag };
}

export async function uploadMultipart(
  multipart: {
    part_size_bytes: number;
    part_presigned_urls: ArrayLike<string>;
    complete_presigned_url: string;
  },
  filePath: string,
  fileSize: number,
): Promise<void> {
  const { part_size_bytes, part_presigned_urls, complete_presigned_url } = multipart;
  const totalParts = part_presigned_urls.length;
  const expectedParts = Math.ceil(fileSize / part_size_bytes);
  if (expectedParts !== totalParts) {
    throw new Error(
      `Multipart layout mismatch: server returned ${totalParts} presigned URLs ` +
        `but ${fileSize} bytes at ${part_size_bytes} bytes/part needs ${expectedParts}`,
    );
  }
  const etags: Array<{ partNumber: number; etag: string }> = [];
  for (let i = 0; i < totalParts; i++) {
    const start = i * part_size_bytes;
    const end = Math.min(start + part_size_bytes, fileSize);
    etags.push(await uploadPart(part_presigned_urls[i], filePath, start, end, i + 1, totalParts));
  }

  // Complete the multipart upload by POSTing the ETags XML to S3.
  const xml = buildCompleteMultipartXml(etags);
  await withRetry(async () => {
    const response = await fetch(complete_presigned_url, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: xml,
    });
    if (!response.ok) {
      // Throw inside withRetry so transient 5xx responses are retried
      // while isRetryableError skips 4xx responses.
      const body = await response.text();
      throw new HttpUploadError(
        `Failed to complete multipart upload: ${response.status} ${body}`,
        response.status,
      );
    }
    return response;
  }, "multipart completion");
}
