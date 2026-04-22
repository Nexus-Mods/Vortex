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

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 150; // 5 minutes

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;

const MULTIPART_CONCURRENCY = 4;

// States considered terminal-non-success. Kept as a runtime check because
// the OpenAPI schema currently only declares "created" | "available", but
// the server may introduce failure states before the spec catches up.
const TERMINAL_FAILURE_STATES = new Set([
  "failed",
  "rejected",
  "cancelled",
  "canceled",
  "expired",
  "errored",
]);

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  attempts = RETRY_ATTEMPTS,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === attempts) break;
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      log("warn", "upload attempt failed, retrying", {
        label,
        attempt,
        attempts,
        delayMs: delay,
        error: describeError(err),
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}

export async function pollUploadAvailable(
  client: NexusV3Client,
  uploadId: string,
): Promise<void> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    const upload = await client.getUpload(uploadId);
    if (upload.state === "available") {
      return;
    }
    const state = upload.state as string;
    if (TERMINAL_FAILURE_STATES.has(state)) {
      throw new Error(
        `Upload ${uploadId} entered terminal failure state: ${state}`,
      );
    }
    log("debug", "polling upload status", {
      uploadId,
      state,
      attempt,
    });
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
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
    () =>
      uploadWithHeaders(presignedUrl, createReadStream(filePath), fileSize),
    "single-part upload",
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
): Promise<{ partNumber: number; etag: string }> {
  const chunkSize = end - start;
  const result = await withRetry<IUploadResult>(
    () => {
      const stream = createReadStream(filePath, { start, end: end - 1 });
      return uploadWithHeaders(url, stream, chunkSize);
    },
    `multipart part ${partNumber}/${totalParts}`,
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
): Promise<void> {
  const { part_size_bytes, part_presigned_urls, complete_presigned_url } =
    multipart;
  const totalParts = part_presigned_urls.length;
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
        );
      }
    },
  );
  await Promise.all(workers);

  // Complete the multipart upload by POSTing the ETags XML to S3.
  const xml = buildCompleteMultipartXml(etags);
  const response = await withRetry(
    () =>
      fetch(complete_presigned_url, {
        method: "POST",
        headers: { "Content-Type": "application/xml" },
        body: xml,
      }),
    "multipart completion",
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to complete multipart upload: ${response.status} ${body}`,
    );
  }
}
