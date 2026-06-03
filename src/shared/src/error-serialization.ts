// Generic Error <-> wire serializer shared across the IPC boundaries (the
// adaptor RPC transport and the renderer<->main callback channels). The
// serializer is agnostic to the error classes it carries: the sender serializes
// `name`, `code`, and any extra own enumerable properties; the receiver
// rehydrates a generic `Error` with those fields copied back, so callers can
// branch on `err.name` and reconstruct their concrete error type.
//
// `cause` chains are serialized recursively up to MAX_CAUSE_DEPTH levels.
// Deeper chains (and non-Error causes) are truncated silently to avoid runaway
// recursion on circular references.

import { getErrorMessage } from "./errors";
import type { SerializedError } from "./types/ipc";

/** Own-property keys that are part of the standard Error surface. */
const STANDARD_ERROR_KEYS = new Set<string>(["name", "message", "stack", "cause", "code"]);

/** How many levels of `cause` chain to carry across the wire. */
export const MAX_CAUSE_DEPTH = 3;

export function extractErrorFields(err: Error): Omit<SerializedError, "cause"> {
  const result: Omit<SerializedError, "cause"> = { message: err.message };
  // Type identity only exists on the live error and is lost the moment it crosses
  // the wire (the receiver always mints a plain `Error`). Prefer the explicit
  // `name` when the author set one; otherwise fall back to the runtime class name
  // (`constructor.name`) so subclasses that never assign `this.name` — and would
  // otherwise serialize as a nameless "Error" — keep their type for downstream
  // consumers (e.g. error fingerprinting that branches on `name`).
  if (err.name && err.name !== "Error") {
    result.name = err.name;
  } else {
    const ctorName = err.constructor?.name;
    if (ctorName !== undefined && ctorName !== "" && ctorName !== "Error") {
      result.name = ctorName;
    }
  }

  const errWithCode = err as Error & { code?: unknown };
  if (typeof errWithCode.code === "string") result.code = errWithCode.code;

  const extras: Record<string, unknown> = {};
  for (const key of Object.getOwnPropertyNames(err)) {
    if (STANDARD_ERROR_KEYS.has(key)) continue;
    const value = (err as unknown as Record<string, unknown>)[key];
    if (typeof value === "function") continue;
    extras[key] = value;
  }
  if (Object.keys(extras).length > 0) result.data = extras;

  return result;
}

export function serializeCause(value: unknown, depth: number): SerializedError | undefined {
  if (depth <= 0) return undefined;
  if (!(value instanceof Error)) return undefined;
  const fields = extractErrorFields(value);
  const nested = serializeCause((value as Error & { cause?: unknown }).cause, depth - 1);
  return nested === undefined ? fields : { ...fields, cause: nested };
}

/** Serialize any thrown value into its wire representation. */
export function serializeError(err: unknown): SerializedError {
  if (!(err instanceof Error)) {
    return { message: getErrorMessage(err) ?? "" };
  }
  const fields = extractErrorFields(err);
  const cause = serializeCause((err as Error & { cause?: unknown }).cause, MAX_CAUSE_DEPTH);
  return cause === undefined ? fields : { ...fields, cause };
}

export function rehydrateSerializedError(serialized: SerializedError): Error {
  const err = new Error(serialized.message, {
    cause: serialized.cause !== undefined ? rehydrateSerializedError(serialized.cause) : undefined,
  });
  if (serialized.name !== undefined) err.name = serialized.name;
  if (serialized.code !== undefined) {
    (err as Error & { code?: string }).code = serialized.code;
  }
  if (serialized.data !== undefined) {
    Object.assign(err, serialized.data);
  }
  return err;
}
