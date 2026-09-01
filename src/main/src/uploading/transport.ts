/**
 * Storage-agnostic upload transport: PUT a file (or one byte range of it) to a
 * URL, with the shared retry strategy on top. Everything here is plain HTTP —
 * the S3 multipart protocol lives in `./s3Multipart`.
 */
import { createReadStream } from "node:fs";

import { type VortexError } from "@vortex/shared";
import type { RetryStrategy } from "@vortex/shared/download";
import type { ExtendOptions, Got, Response } from "got";
import got from "got";

import { log } from "../logging";
import { isCancellation } from "../transfer/cancellation";
import { defaultRetryStrategy, withRetry } from "../transfer/retry";
import type { TimeoutOptions } from "../transfer/timeouts";
import { createGotTimeoutOptions } from "../transfer/timeouts";
import { describePresignedUrl, missingSignedHeaders, redactUrl, toUploadError } from "./errors";

/**
 * `connect` matches the download path. `stall` is more generous because the
 * server acknowledges a body only once it has ingested it, so a large request
 * can go quiet for a while before the response arrives.
 */
export const defaultTimeout: () => TimeoutOptions = () => ({
  lookup: 5_000,
  connect: 30_000,
  stall: 60_000,
});

/**
 * Reports bytes handed to the socket for the current transfer. Not monotonic:
 * a retried request restarts its body from zero.
 */
export type ProgressHandler = (transferred: number) => void;

/**
 * Headers the presigned URL's signature may cover. The signer dictates these
 * values, so the caller has to pass what the storage session was created with —
 * sending a different value, or omitting one the signature covers, both fail as
 * `SignatureDoesNotMatch`.
 */
export type UploadHeaders = {
  contentType?: string;
  contentDisposition?: string;
};

export type UploadOptions = {
  abortSignal?: AbortSignal;
  retry?: RetryStrategy;
  timeout?: TimeoutOptions;
  userAgent?: string;
  headers?: UploadHeaders;
  onProgress?: ProgressHandler;
};

const DEFAULT_CONTENT_TYPE = "application/octet-stream";

function buildHeaders(size: number, headers: UploadHeaders | undefined): Record<string, string> {
  const result: Record<string, string> = {
    "content-type": headers?.contentType ?? DEFAULT_CONTENT_TYPE,
    // Declaring the length keeps the body out of chunked transfer encoding,
    // which signed-URL endpoints generally reject.
    "content-length": size.toString(),
  };
  if (headers?.contentDisposition !== undefined) {
    result["content-disposition"] = headers.contentDisposition;
  }
  return result;
}

export type UploadSession = {
  got: Got;
  retry: RetryStrategy;
  abortSignal?: AbortSignal;
  headers?: UploadHeaders;
};

export function createSession(options?: UploadOptions): UploadSession {
  return {
    got: got.extend({
      signal: options?.abortSignal,
      timeout: createGotTimeoutOptions(options?.timeout ?? defaultTimeout()),
      // Retries are driven by the shared strategy, which recreates the request
      // body on each attempt. got's own retry would replay a consumed stream.
      retry: { limit: 0 },
      headers: {
        "User-Agent": options?.userAgent,
      },
    } satisfies ExtendOptions),
    retry: options?.retry ?? defaultRetryStrategy(),
    abortSignal: options?.abortSignal,
    headers: options?.headers,
  };
}

/**
 * PUTs `filePath` (or one byte range of it) and returns the response. Omitting
 * `range` streams the whole file.
 */
export async function putFile(
  session: UploadSession,
  url: string,
  filePath: string,
  size: number,
  label: string,
  range?: { start: number; end: number },
  onProgress?: ProgressHandler,
): Promise<Response<string>> {
  const started = Date.now();
  const headers = buildHeaders(size, session.headers);

  let reported = 0;

  const response = await withRetry(
    async () => {
      // A fresh stream per attempt: a stream consumed (or destroyed) by a
      // failed attempt cannot be replayed.
      const body = createReadStream(
        filePath,
        range ? { start: range.start, end: range.end - 1 } : undefined,
      );
      try {
        const request = session.got(url, {
          method: "PUT",
          body,
          headers,
        });
        if (onProgress) {
          // Re-attached per attempt, so a retry reports from zero again. `.on`
          // returns the request itself, which is awaited just below.
          void request.on("uploadProgress", ({ transferred }) => {
            reported = transferred;
            onProgress(transferred);
          });
        }
        return await request;
      } catch (err) {
        // An attempt that failed before draining the body leaves the handle
        // open; a multipart upload would leak one per retry.
        body.destroy();
        if (isCancellation(err)) throw err;
        const uploadError = toUploadError(url, err);
        logRejection(url, label, size, Object.keys(headers), uploadError);
        throw uploadError;
      }
    },
    session.retry,
    session.abortSignal,
  );

  // got reports the last chunk only from the request's end callback, which it
  // skips when the response arrived first and tore the request down. The success
  // means every byte landed, so close the gap.
  if (onProgress && reported < size) onProgress(size);

  log("debug", "upload request complete", {
    label,
    url: redactUrl(url),
    size,
    statusCode: response.statusCode,
    elapsed: Date.now() - started,
  });

  return response;
}

/**
 * A rejected upload is hard to diagnose from the status code alone, so record
 * what the signature covers alongside the headers we actually sent. Everything
 * logged here is non-secret: the signature itself stays in the query string,
 * which `redactUrl` removes.
 */
function logRejection(
  url: string,
  label: string,
  size: number,
  sentHeaders: string[],
  err: VortexError,
): void {
  const { data } = err;
  const statusCode = data.kind === "http:bad-status" ? data.statusCode : undefined;
  const missing = missingSignedHeaders(url, sentHeaders);
  log("warn", "upload request rejected", {
    label,
    url: redactUrl(url),
    size,
    code: data.kind,
    statusCode,
    error: err.message,
    sentHeaders: sentHeaders.join(", "),
    // Non-empty means the signature cannot match, whatever else is wrong.
    missingSignedHeaders: missing.length > 0 ? missing.join(", ") : undefined,
    ...describePresignedUrl(url),
  });
}

/** POSTs a body to `url`, retried on the same terms as {@link putFile}. */
export async function postBody(
  session: UploadSession,
  url: string,
  body: string,
  contentType: string,
): Promise<Response<string>> {
  return await withRetry(
    async () => {
      try {
        return await session.got(url, {
          method: "POST",
          body,
          headers: { "content-type": contentType },
        });
      } catch (err) {
        if (isCancellation(err)) throw err;
        const uploadError = toUploadError(url, err);
        logRejection(url, "completion", body.length, ["content-type"], uploadError);
        throw uploadError;
      }
    },
    session.retry,
    session.abortSignal,
  );
}

/**
 * PUTs the whole file to a single URL.
 */
export async function uploadFile(
  url: string,
  filePath: string,
  fileSize: number,
  options?: UploadOptions,
): Promise<void> {
  const session = createSession(options);
  await putFile(session, url, filePath, fileSize, "whole file", undefined, options?.onProgress);
}
