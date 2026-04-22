import type { NexusV3Client } from "@vortex/nexus-api-v3";

import { createReadStream } from "fs";

import { log } from "../../../logging";
import { uploadWithHeaders, type IUploadResult } from "../../../util/network";

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "<unserialisable error>";
  }
}

function abortError(signal: AbortSignal | undefined): Error {
  const reason: unknown = signal?.reason;
  if (reason instanceof Error) return reason;
  if (typeof reason === "string") return new Error(reason);
  return new Error("Aborted");
}

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 150; // 5 minutes

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;

const MULTIPART_CONCURRENCY = 4;

// States declared by the OpenAPI schema. A successful upload transitions
// created → available; anything else is an unknown state we did not opt into.
const KNOWN_INPROGRESS_STATES = new Set(["created"]);
const SUCCESS_STATE = "available";
// How many consecutive unknown-state observations we tolerate before bailing.
// One transient observation can be legitimate if the server introduces a new
// intermediate state before the schema catches up; three in a row is not.
const UNKNOWN_STATE_TOLERANCE = 3;

function statusCodeOf(err: unknown): number | undefined {
  if (err !== null && typeof err === "object" && "statusCode" in err) {
    const sc = (err as { statusCode?: unknown }).statusCode;
    if (typeof sc === "number") return sc;
  }
  if (err !== null && typeof err === "object" && "status" in err) {
    const s = (err as { status?: unknown }).status;
    if (typeof s === "number") return s;
  }
  return undefined;
}

function isRetryableError(err: unknown): boolean {
  const sc = statusCodeOf(err);
  if (sc === undefined) {
    // No status — treat as transport error, retry.
    return true;
  }
  // 4xx are client errors and generally not worth retrying. 408 (timeout)
  // and 429 (rate-limit) are the conventional exceptions.
  if (sc >= 400 && sc < 500 && sc !== 408 && sc !== 429) {
    return false;
  }
  return true;
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(abortError(signal));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError(signal));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

interface IRetryOptions {
  attempts?: number;
  signal?: AbortSignal;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  options: IRetryOptions = {},
): Promise<T> {
  const { attempts = RETRY_ATTEMPTS, signal } = options;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (signal?.aborted) throw abortError(signal);
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === attempts || !isRetryableError(err)) {
        if (!isRetryableError(err)) {
          log("debug", "upload attempt failed, not retrying", {
            label,
            statusCode: statusCodeOf(err),
            error: describeError(err),
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
        error: describeError(err),
      });
      await abortableSleep(delay, signal);
    }
  }
  throw lastErr;
}

export async function pollUploadAvailable(
  client: NexusV3Client,
  uploadId: string,
  signal?: AbortSignal,
): Promise<void> {
  let unknownStreak = 0;
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) throw abortError(signal);

    const upload = await client.getUpload(uploadId);
    const state = upload.state as string;
    if (state === SUCCESS_STATE) {
      return;
    }
    if (KNOWN_INPROGRESS_STATES.has(state)) {
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
    await abortableSleep(POLL_INTERVAL_MS, signal);
  }
  throw new Error(
    `Upload ${uploadId} did not become available within ${(POLL_INTERVAL_MS * POLL_MAX_ATTEMPTS) / 1000}s`,
  );
}

export async function uploadSinglePart(
  presignedUrl: string,
  filePath: string,
  fileSize: number,
  signal?: AbortSignal,
): Promise<void> {
  await withRetry<IUploadResult>(
    () =>
      uploadWithHeaders(
        presignedUrl,
        createReadStream(filePath),
        fileSize,
        undefined,
        signal,
      ),
    "single-part upload",
    { signal },
  );
}

function buildCompleteMultipartXml(
  etags: Array<{ partNumber: number; etag: string }>,
): string {
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
  signal?: AbortSignal,
): Promise<{ partNumber: number; etag: string }> {
  const chunkSize = end - start;
  const result = await withRetry<IUploadResult>(
    () => {
      const stream = createReadStream(filePath, { start, end: end - 1 });
      return uploadWithHeaders(url, stream, chunkSize, undefined, signal);
    },
    `multipart part ${partNumber}/${totalParts}`,
    { signal },
  );

  const rawEtag = result.headers["etag"];
  const etag = Array.isArray(rawEtag) ? rawEtag[0] : rawEtag;
  if (!etag) {
    throw new Error(
      `S3 did not return an ETag for part ${partNumber} of multipart upload`,
    );
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
    part_presigned_urls: string[];
    complete_presigned_url: string;
  },
  filePath: string,
  fileSize: number,
  signal?: AbortSignal,
): Promise<void> {
  const { part_size_bytes, part_presigned_urls, complete_presigned_url } =
    multipart;
  const totalParts = part_presigned_urls.length;
  const expectedParts = Math.ceil(fileSize / part_size_bytes);
  if (expectedParts !== totalParts) {
    throw new Error(
      `Multipart layout mismatch: server returned ${totalParts} presigned URLs ` +
        `but ${fileSize} bytes at ${part_size_bytes} bytes/part needs ${expectedParts}`,
    );
  }
  const etags: Array<{ partNumber: number; etag: string }> = new Array(
    totalParts,
  );

  // Worker-pool pattern: N workers drain a shared index counter. Preserves
  // insertion order in `etags` regardless of completion order.
  let next = 0;
  const workers = Array.from(
    { length: Math.min(MULTIPART_CONCURRENCY, totalParts) },
    async () => {
      while (true) {
        if (signal?.aborted) throw abortError(signal);
        const i = next++;
        if (i >= totalParts) return;
        const start = i * part_size_bytes;
        const end = Math.min(start + part_size_bytes, fileSize);
        etags[i] = await uploadPart(
          part_presigned_urls[i],
          filePath,
          start,
          end,
          i + 1,
          totalParts,
          signal,
        );
      }
    },
  );
  await Promise.all(workers);

  // Complete the multipart upload by POSTing the ETags XML to S3.
  const xml = buildCompleteMultipartXml(etags);
  await withRetry(
    async () => {
      const response = await fetch(complete_presigned_url, {
        method: "POST",
        headers: { "Content-Type": "application/xml" },
        body: xml,
        signal,
      });
      if (!response.ok) {
        // Throw inside withRetry so transient 5xx responses are retried.
        // Status is attached so isRetryableError can skip 4xx responses.
        const body = await response.text();
        const err = new Error(
          `Failed to complete multipart upload: ${response.status} ${body}`,
        ) as Error & { statusCode: number };
        err.statusCode = response.status;
        throw err;
      }
      return response;
    },
    "multipart completion",
    { signal },
  );
}
