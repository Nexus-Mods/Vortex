// Generic Error <-> wire serializer shared across the IPC boundaries (the
// adaptor RPC transport and the renderer<->main callback channels). The sender
// serializes `name`, `code`, and any extra own enumerable properties; the
// receiver rebuilds a generic `Error` with those fields copied back, so callers
// can branch on `err.name` (e.g. via isErrorOfType) rather than `instanceof`.
//
// When a context owns the live error (the renderer, for a callback error that
// round-trips back to it), an optional ErrorOriginTracker passes it by
// reference instead — the original object is handed back verbatim, preserving
// identity, prototype and the real throw-site stack. This is the only path that
// recovers the concrete type across the wire; everything else is a plain Error.
//
// `cause` chains are serialized recursively up to MAX_CAUSE_DEPTH levels.
// Deeper chains (and non-Error causes) are truncated silently to avoid runaway
// recursion on circular references.

import { getErrorMessage } from "./errors";
import type { SerializedError } from "./types/ipc";

/**
 * Optional hook a context installs to pass errors it owns by reference instead
 * of by value. The classic case: the renderer makes an IPC call, main invokes a
 * renderer callback, that callback throws, and main proxies the error back to
 * the renderer. The thrown error never actually left the renderer's heap, so
 * instead of reconstructing a lossy copy we stash the live object on
 * serialization (`capture`) and hand the original straight back when it returns
 * (`resolve`) — preserving identity, prototype and the real throw-site stack.
 *
 * Each context (renderer, main) may install its own tracker for the round-trips
 * it owns; a tracker only ever resolves errors it captured. `namespace` keeps
 * two installed trackers from colliding: refs are tagged with it on the wire,
 * and a ref carrying a different namespace is ignored and falls back to generic
 * `Error` hydration. A context that installs nothing always hydrates.
 */
export interface ErrorOriginTracker {
  /**
   * Distinct id for the installing context (e.g. "renderer", "main"). Namespaces
   * ref tokens so two trackers can't mis-resolve each other's errors.
   */
  readonly namespace: string;
  /** Stash a live error and return a context-local id, or undefined to opt out. */
  capture(err: Error): string | undefined;
  /** Return the original for a context-local id (namespace already stripped), if still held. */
  resolve(id: string): Error | undefined;
}

let originTracker: ErrorOriginTracker | undefined;

/** Install (or clear, with `undefined`) the by-reference tracker for this context. */
export function setErrorOriginTracker(tracker: ErrorOriginTracker | undefined): void {
  originTracker = tracker;
}

// Key under which the by-reference token rides in `data`. Living in `data`
// (rather than a dedicated SerializedError field) means it survives a context
// that rehydrates and re-serializes the error in transit (e.g. main relaying a
// renderer callback error back), since `data` is copied onto the error and
// re-extracted as an own property.
const ORIGIN_REF_KEY = "__originRef";

/** Own-property keys that are part of the standard Error surface. */
const STANDARD_ERROR_KEYS = new Set<string>(["name", "message", "stack", "cause", "code"]);

/** How many levels of `cause` chain to carry across the wire. */
export const MAX_CAUSE_DEPTH = 3;

export function extractErrorFields(err: Error): Omit<SerializedError, "cause"> {
  const result: Omit<SerializedError, "cause"> = { message: err.message };
  // Type identity is lost on the wire (the receiver mints a plain `Error`), so
  // `name` is the only type signal downstream consumers have — both callers
  // branching via isErrorOfType and error fingerprinting. Prefer the explicit
  // `name` when the author set one; otherwise fall back to the runtime class
  // name (`constructor.name`) so subclasses that never assign `this.name` — and
  // would otherwise serialize as a nameless "Error" — keep their type.
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
  const result: SerializedError = cause === undefined ? fields : { ...fields, cause };

  // If this context owns the live error, stash it and tag the wire form (with
  // this tracker's namespace) so the original can be handed back if it returns
  // here (see ErrorOriginTracker).
  if (originTracker !== undefined) {
    const id = originTracker.capture(err);
    if (id !== undefined) {
      result.data = { ...result.data, [ORIGIN_REF_KEY]: `${originTracker.namespace}:${id}` };
    }
  }

  return result;
}

export function rehydrateSerializedError(serialized: SerializedError): Error {
  // By-reference fast path: if this context still holds the original, return it as-is.
  // Avoids using the generic Error constructor and losing identity, prototype and the real throw-site stack.
  const ref = serialized.data?.[ORIGIN_REF_KEY];
  if (typeof ref === "string" && originTracker !== undefined) {
    // Only resolve refs this context minted; another context's namespace (or an
    // evicted ref) falls through to plain-Error hydration below.
    const prefix = `${originTracker.namespace}:`;
    if (ref.startsWith(prefix)) {
      const original = originTracker.resolve(ref.slice(prefix.length));
      if (original !== undefined) return original;
    }
  }

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
