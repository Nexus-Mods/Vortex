import { UploadError } from "@vortex/shared/errors";
import { TimeoutError, HTTPError, RequestError } from "got";

/** How much of an unrecognised error body to keep in the message. */
const MAX_BODY_CHARS = 400;

/**
 * Upload URLs are signed, with the credential in the query string. Strip it
 * before the URL reaches a log line or an error message.
 */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "<unparseable url>";
  }
}

/**
 * S3-compatible storage answers a rejected request with an XML document naming
 * the reason — `SignatureDoesNotMatch`, `AccessDenied`, `RequestTimeTooSkewed`
 * and so on. The status code alone doesn't distinguish them, and each points at
 * a different fix, so lift it into the message.
 */
export function describeErrorBody(body: string): string | undefined {
  if (body === "") return undefined;

  const code = /<Code>([^<]+)<\/Code>/.exec(body)?.[1];
  const message = /<Message>([^<]+)<\/Message>/.exec(body)?.[1];
  if (code !== undefined) {
    return message === undefined ? code : `${code}: ${message}`;
  }

  const collapsed = body.replace(/\s+/g, " ").trim();
  if (collapsed === "") return undefined;
  return collapsed.length > MAX_BODY_CHARS ? `${collapsed.slice(0, MAX_BODY_CHARS)}…` : collapsed;
}

/**
 * The non-secret parts of a presigned URL, for a log line when the storage
 * rejects it. `signedHeaders` is the set the signature covers: sending a header
 * listed there with a value the signer didn't use invalidates the signature,
 * which is otherwise indistinguishable from a permissions problem. The expiry
 * fields catch a URL that was already stale — including a skewed local clock.
 */
export function describePresignedUrl(url: string): Record<string, unknown> {
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    return {};
  }

  const details: Record<string, unknown> = {};

  const signedHeaders = params.get("X-Amz-SignedHeaders");
  if (signedHeaders !== null) details.signedHeaders = signedHeaders;

  const algorithm = params.get("X-Amz-Algorithm");
  if (algorithm !== null) details.algorithm = algorithm;

  // X-Amz-Date is ISO8601 basic format, e.g. 20260805T101530Z.
  const signedAt = parseAmzDate(params.get("X-Amz-Date"));
  const expiresIn = Number(params.get("X-Amz-Expires"));
  if (signedAt !== undefined) {
    details.signedAt = signedAt.toISOString();
    if (Number.isFinite(expiresIn) && expiresIn > 0) {
      const expiresAt = new Date(signedAt.getTime() + expiresIn * 1000);
      details.expiresAt = expiresAt.toISOString();
      details.expired = expiresAt.getTime() < Date.now();
    }
  }

  return details;
}

/**
 * Signed headers we are not sending. Each one is enough on its own to produce
 * `SignatureDoesNotMatch`, because the server rebuilds the signature over the
 * headers the signature claims to cover and finds ours empty.
 *
 * `host` is set by the HTTP layer and `content-length` rides with the body, so
 * neither can be missing.
 */
export function missingSignedHeaders(url: string, sent: Iterable<string>): string[] {
  let signedHeaders: string | null;
  try {
    signedHeaders = new URL(url).searchParams.get("X-Amz-SignedHeaders");
  } catch {
    return [];
  }
  if (signedHeaders === null) return [];

  const implicit = new Set(["host", "content-length"]);
  const sentNames = new Set([...sent].map((name) => name.toLowerCase()));

  return signedHeaders
    .split(";")
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name !== "" && !implicit.has(name) && !sentNames.has(name));
}

function parseAmzDate(value: string | null): Date | undefined {
  if (value === null) return undefined;
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  );
}

export function toUploadError(url: string, err: unknown): UploadError {
  const redacted = redactUrl(url);

  if (err instanceof UploadError) return err;
  if (err instanceof TimeoutError) {
    return new UploadError(
      { code: "network-timeout", url: redacted },
      "Upload request timed out",
      err,
    );
  }
  if (err instanceof HTTPError) {
    const { statusCode } = err.response;
    const body = typeof err.response.body === "string" ? err.response.body : "";
    const detail = describeErrorBody(body);
    return new UploadError(
      { code: "network-bad-status", url: redacted, statusCode },
      detail === undefined
        ? `Server returned ${statusCode}`
        : `Server returned ${statusCode} — ${detail}`,
      err,
    );
  }
  if (err instanceof RequestError) {
    return new UploadError({ code: "network-error", url: redacted }, "Network request failed", err);
  }
  return new UploadError({ code: "network-error", url: redacted }, "Unknown network error", err);
}
