import { z } from "zod";

import { VortexError } from "./base";

export function parseError(cause: unknown, context?: { path?: string; url?: string }): VortexError {
  if (cause instanceof VortexError) return cause;

  if (!(cause instanceof Error)) {
    if (typeof cause !== "string") {
      return new VortexError(
        `Unknown value thrown as error. Type=${typeof cause} Value=${String(cause)}`,
        { kind: "unknown" },
      );
    }

    return new VortexError(`Unknown error thrown as string: '${cause}'`, { kind: "unknown" });
  }

  const parsedSystemError = parseNodeSystemError(cause, context);
  if (parsedSystemError) return parsedSystemError;

  return new VortexError(
    `Unknown error thrown: ${cause.name} ${cause.message}`,
    { kind: "unknown" },
    { cause },
  );
}

/** POSIX codes for network-level failures. */
const NETWORK_POSIX_CODES = new Set([
  "ECONNRESET", // Connection reset by peer (POSIX.1-2001)
  "ECONNABORTED", // Connection aborted (POSIX.1-2001)
  "ECONNREFUSED", // Connection refused (POSIX.1-2001)
  "ENETUNREACH", // Network unreachable (POSIX.1-2001)
  "ETIMEDOUT", // Connection timed out (POSIX.1-2001)
  "EAI_AGAIN", // Temporary DNS resolution failure
  "EPROTO", // Protocol error (POSIX.1-2001)
]);

function parseNodeSystemError(
  cause: Error,
  context?: { path?: string; url?: string },
): VortexError | undefined {
  const data = parseNodeSystemErrorData(cause);
  if (!data) {
    return undefined;
  }

  const { code: originalCode, errno, syscall } = data;
  const osData = { originalCode, errno, syscall };

  const hasPath = context?.path !== undefined || data?.path !== undefined;
  const path = context?.path ?? data?.path ?? "<unknown path>";

  const { message } = cause;

  if (originalCode === "EACCES" || originalCode === "EPERM") {
    // EACCES: Permission denied (POSIX.1-2001).
    // EPERM: Operation not permitted (POSIX.1-2001).

    // NOTE(erri120): EACCES and EPERM are not FS-exclusive codes, if we don't have a path we
    // must not default to an FS error.
    if (hasPath) {
      return new VortexError(message, { kind: "fs:no-permissions", ...osData, path }, { cause });
    }
  } else if (originalCode === "ENOENT") {
    // ENOENT: No such file or directory (POSIX.1-2001).
    return new VortexError(
      `File or directory does not exist at '${path}'`,
      { kind: "fs:not-found", ...osData, path },
      { cause },
    );
  } else if (originalCode === "EEXIST") {
    // EEXIST: File exists (POSIX.1-2001).
    return new VortexError(
      `File at '${path}' already exists`,
      { kind: "fs:already-exists", ...osData, path },
      { cause },
    );
  } else if (originalCode === "ENOSPC") {
    // ENOSPC: No space left on device (POSIX.1-2001)
    return new VortexError(
      `No space left on device: '${path}'`,
      { kind: "fs:no-space", ...osData, path },
      { cause },
    );
  } else if (originalCode === "ENOTDIR") {
    // ENOTDIR: Not a directory (POSIX.1-2001).
    return new VortexError(
      `Path is not a directory: '${path}'`,
      { kind: "fs:not-a-directory", ...osData, path },
      { cause },
    );
  } else if (originalCode === "EISDIR") {
    // EISDIR: Is a directory (POSIX.1-2001).
    return new VortexError(
      `Path is not a file: '${path}'`,
      { kind: "fs:not-a-file", ...osData, path },
      { cause },
    );
  } else if (originalCode === "ENOTEMPTY") {
    // ENOTEMPTY: Directory not empty (POSIX.1-2001).
    return new VortexError(
      `Directory is not empty: '${path}'`,
      { kind: "fs:directory-not-empty", ...osData, path },
      { cause },
    );
  } else if (originalCode === "EMFILE") {
    // EMFILE: Too many open files (POSIX.1-2001).
    return new VortexError(
      message,
      { kind: "os:generic", ...osData },
      { cause, isTransient: true },
    );
  } else if (originalCode === "EBUSY") {
    // EBUSY: Device or resource busy (POSIX.1-2001)
    return new VortexError(
      message,
      { kind: "os:generic", ...osData },
      { cause, isTransient: true },
    );
  } else if (NETWORK_POSIX_CODES.has(originalCode)) {
    const isTransient = originalCode === "ETIMEDOUT";

    if (context?.url !== undefined) {
      return new VortexError(
        `Network error (${originalCode}) for '${context.url}': ${message}`,
        { kind: "http:generic", url: context.url, ...osData },
        { cause, isTransient },
      );
    }

    return new VortexError(message, { kind: "os:generic", ...osData }, { cause, isTransient });
  }

  return new VortexError(message, { kind: "os:generic", ...osData }, { cause });
}

export function parseNodeSystemErrorData(input: unknown): NodeSystemErrorData | undefined {
  const res = nodeSystemErrorDataSchema.safeParse(input);
  const data = res.data satisfies NodeSystemErrorData | undefined;
  return data;
}

/** Representation of a Node.js SystemError
 *
 * Source: https://github.com/nodejs/node/blob/main/lib/internal/errors.js
 * Docs: https://nodejs.org/api/errors.html#class-systemerror
 * */
export type NodeSystemErrorData = {
  /** Closed set of named POSIX-style error codes.
   *
   * Node.js adopted mostly real POSIX error codes but they also have
   * custom error codes.
   *
   * Source: https://github.com/nodejs/node/blob/727e2bce8e94b954affd5e9b74353f18b3a0f0f3/lib/internal/errors.js#L1238-L1249
   * */
  code: string;

  /** Closed set corresponding to libuv error codes.
   *
   * From the docs (https://docs.libuv.org/en/stable/errors.html):
   *
   * On Unix error codes are the negated errno (or -errno),
   * while on Windows they are defined by libuv to arbitrary negative numbers.
   * Source: https://github.com/nodejs/node/blob/main/deps/uv/include/uv/errno.h
   *
   * Useful Node.js APIs:
   * - `util.getSystemErrorMap()`: maps `errno` values to error names and messages
   * - `util.getSystemErrorName(errno)`: returns error name for `errno` value
   * - `util.getSystemErrorMessage(errno)`: returns error message for `errno` value
   * */
  errno: number;

  /** The syscall that failed. */
  syscall: string;

  /** A relevant invalid pathname. */
  path?: string;

  /** File path destination when reporting a file system error. */
  dest?: string;

  /** Address to which a network connection failed */
  address?: string;

  /** Network connection port that is not available. */
  port?: number;

  /** The original libuv context. */
  info?: unknown;
};

const nodeSystemErrorDataSchema = z.looseObject({
  code: z.string(),
  errno: z.number(),
  syscall: z.string(),
  path: z.string().optional(),
  dest: z.string().optional(),
  address: z.string().optional(),
  port: z.number().optional(),
  info: z.looseObject({}).optional(),
});
