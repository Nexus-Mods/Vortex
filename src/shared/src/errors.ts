/** Extracts an error message from an unknown value in a catch statement */
export function getErrorMessage(err: unknown): string | null {
  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === "string") {
    return err;
  }

  return null;
}

export function getErrorMessageOrDefault(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === "string") {
    return err;
  }

  return "unknown error";
}

/** Casts or converts the unknown into an Error */
export function unknownToError(err: unknown): Error {
  if (err instanceof Error) {
    return err;
  }

  if (typeof err === "string") {
    return new Error(err);
  }

  return new Error("unknown error");
}

/** Extracts the code property from a potential error object */
export function getErrorCode(err: unknown): string | null {
  if (!(err instanceof Error)) {
    return null;
  }

  if (!("code" in err)) {
    return null;
  }

  if (typeof err.code !== "string") {
    return null;
  }

  return err.code;
}

type ErrorWithSystemCode = Error & { systemCode: number | bigint };

/** Extracts the system code property from a potential error object */
export function isErrorWithSystemCode(
  err: unknown,
): err is ErrorWithSystemCode {
  if (!(err instanceof Error)) {
    return false;
  }

  if (
    "systemCode" in err &&
    (typeof err.systemCode === "number" || typeof err.systemCode === "bigint")
  )
    return true;

  return false;
}

/**
 * Compute a fingerprint from the stack trace call frames and app version.
 * Same error from the same code path in the same version produces the same hash,
 * which can be used for deduplication on the backend.
 */
export const computeErrorFingerprint = (
  stack: string | undefined,
  appVersion: string,
): string | undefined => {
  if (stack === undefined) return undefined;
  const frames = stack
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at "));
  if (frames.length === 0) return undefined;
  const input = frames.join("\n") + "\n" + appVersion;
  return fnv1aHash(input);
};

/** FNV-1a hash producing an 8-char hex string. Not cryptographic —
 *  used only for error deduplication fingerprints. */
const fnv1aHash = (input: string): string => {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0; // FNV prime, keep as uint32
  }
  return hash.toString(16).padStart(8, "0");
};
