import type { FileSystemErrorCode } from "@nexusmods/adaptor-api/fs";

export interface ParsedNodeError {
  code: FileSystemErrorCode;
  isTransient: boolean;
  originalCode: string;
}

/**
 * Normalizes a raw Node.js error into a semantic {@link FileSystemErrorCode}.
 * Node is inconsistent about where it puts the error code, so this mirrors the
 * mapping used by the filesystem backend and is the single place download I/O
 * (which uses `node:fs` directly rather than the filesystem service) reuses to
 * avoid leaking raw errno strings into the rest of the app.
 */
export function parseNodeError(err: unknown): ParsedNodeError {
  if (!(err instanceof Error)) {
    return { code: "generic", isTransient: false, originalCode: "" };
  }

  // https://nodejs.org/api/errors.html
  // NOTE(erri120): Node.js is inconsistent when it comes to data on Errors.
  // The error code that we care about is on err.info.code or err.code if err.info doesn't exist

  if (!("code" in err) || typeof err.code !== "string") {
    return { code: "generic", isTransient: false, originalCode: "" };
  }

  const originalCode =
    "info" in err &&
    typeof err.info === "object" &&
    err.info !== null &&
    "code" in err.info &&
    typeof err.info.code === "string"
      ? err.info.code
      : err.code;

  // NOTE(erri120): Node.js uses POSIX error names as codes
  // https://www.man7.org/linux/man-pages/man3/errno.3.html
  // https://nodejs.org/api/errors.html#common-system-errors
  if (originalCode === "EACCES" || originalCode === "EPERM") {
    // EACCES: Permission denied (POSIX.1-2001).
    // EPERM: Operation not permitted (POSIX.1-2001).
    return { code: "no permissions", isTransient: false, originalCode };
  } else if (originalCode === "ENOENT") {
    // ENOENT: No such file or directory (POSIX.1-2001).
    return { code: "not found", isTransient: false, originalCode };
  } else if (originalCode === "EEXIST") {
    // EEXIST: File exists (POSIX.1-2001).
    return { code: "already exists", isTransient: false, originalCode };
  } else if (originalCode === "ENOSPC") {
    // ENOSPC: No space left on device (POSIX.1-2001)
    return { code: "no space", isTransient: false, originalCode };
  } else if (originalCode === "ENOTDIR") {
    // ENOTDIR: Not a directory (POSIX.1-2001).
    return { code: "not a directory", isTransient: false, originalCode };
  } else if (originalCode === "EISDIR") {
    // EISDIR: Is a directory (POSIX.1-2001).
    return { code: "not a file", isTransient: false, originalCode };
  } else if (originalCode === "ENOTEMPTY") {
    // ENOTEMPTY: Directory not empty (POSIX.1-2001).
    return { code: "directory not empty", isTransient: false, originalCode };
  } else if (originalCode === "EMFILE" || originalCode === "EBUSY") {
    // EMFILE: Too many open files (POSIX.1-2001).
    // EBUSY: Device or resource busy (POSIX.1-2001)
    return { code: "generic", isTransient: true, originalCode };
  } else {
    return { code: "generic", isTransient: false, originalCode };
  }
}
