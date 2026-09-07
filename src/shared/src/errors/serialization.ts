import {
  ArgumentInvalid,
  CycleError,
  DataInvalid,
  GameNotFound,
  MissingInterpreter,
  NotFound,
  NotSupportedError,
  ProcessCanceled,
  SetupError,
  UserCanceled,
} from "../types/errors";
import { VortexError, type VortexErrorData } from "./base";
import { parseError } from "./parser";

/**
 * Caller-owned hook to carry errors a context owns by reference instead of by
 * value. The classic case: the renderer makes an IPC call, main invokes a
 * renderer callback, that callback throws, and main proxies the error back to
 * the renderer. The thrown error never actually left the renderer's heap, so
 * instead of reconstructing a lossy copy the caller stashes the live object when
 * serializing (`capture`) and hands the original straight back when it returns
 * (`resolve`) preserving identity, prototype and the real throw-site stack.
 *
 * The tracker (and its stash) live in the caller. Each context (renderer,
 * main) owns its own; a tracker only ever resolves errors it captured.
 * `namespace` keeps two trackers from colliding: refs are tagged with it on the
 * wire, and a ref carrying a different namespace is ignored and falls back to
 * generic hydration. Calls that pass no tracker always hydrate.
 */
export interface ErrorOriginTracker {
  /**
   * Distinct id for the owning context (e.g. "renderer", "main"). Namespaces ref
   * tokens so two trackers can't mis-resolve each other's errors.
   */
  readonly namespace: string;
  /** Stash a live error and return a context-local id, or undefined to opt out. */
  capture(err: VortexError): string | undefined;
  /** Return the original for a context-local id (namespace already stripped), if still held. */
  resolve(id: string): VortexError | undefined;
}

/** Key under which the by-reference token rides in `data`. */
export const ORIGIN_REF_KEY = "__originRef" as const;

/** How many levels of `cause` chain to carry across the wire. */
const MAX_CAUSE_DEPTH = 5;

type WithRef<T> = T & { [ORIGIN_REF_KEY]?: string };

/** The VortexError wire form. */
export interface SerializedVortexError {
  message: string;
  data: WithRef<VortexErrorData>;
  isTransient: boolean;
  /**
   * Throw-site stack. Without it a rehydrated error's stack starts at
   * {@link deserializeVortexError}, which is identical for every error that
   * crosses the boundary and so collapses them all onto one fingerprint.
   */
  stack?: string;
  cause?: SerializedVortexError;
}

/**
 * Serialize a live {@link VortexError} to its wire form, coerced cause chain up to {@link MAX_CAUSE_DEPTH} levels.
 *
 * Non-VortexError Error causes are coerced through `parseError` so the wire
 * chain stays uniformly typed; non-Error causes are dropped.
 */
export function serializeVortexError(err: VortexError, depth: number = 0): SerializedVortexError {
  const payload: WithRef<VortexErrorData> = { ...err.data };
  // TODO: can throw if payload contains values that can't be cloned, what behavior do we want here?
  const serializedData = structuredClone(payload);

  const result: SerializedVortexError = {
    message: err.message,
    data: serializedData,
    isTransient: err.isTransient,
  };

  if (err.stack !== undefined) {
    result.stack = err.stack;
  }

  if (err.cause !== undefined) {
    const serializedCause = serializeCause(err.cause, depth + 1);
    if (serializedCause !== undefined) result.cause = serializedCause;
  }

  return result;
}

function serializeCause(value: unknown, depth: number): SerializedVortexError | undefined {
  if (depth > MAX_CAUSE_DEPTH) return undefined;
  if (value instanceof VortexError) return serializeVortexError(value, depth);
  if (value instanceof Error) return serializeVortexError(parseError(value), depth);
  return undefined;
}

/**
 * Rehydrate a {@link SerializedVortexError} into a live {@link VortexError}.
 * Pass the same `tracker` used to serialize to recover an error this context
 * owns by reference instead of reconstructing it.
 */
export function deserializeVortexError(
  serialized: SerializedVortexError,
  tracker?: ErrorOriginTracker,
): VortexError {
  const ref = serialized.data[ORIGIN_REF_KEY];
  if (ref !== undefined && tracker !== undefined) {
    const prefix = `${tracker.namespace}:`;
    if (ref.startsWith(prefix)) {
      const original = tracker.resolve(ref.slice(prefix.length));
      if (original !== undefined) return original;
    }
  }

  const cause =
    serialized.cause !== undefined ? deserializeVortexError(serialized.cause, tracker) : undefined;

  const data: WithRef<VortexErrorData> = { ...serialized.data };
  // Preserve the origin-ref token on `data` so a context that re-serializes the
  // rehydrated error in transit (e.g. main relaying a renderer callback error
  // back) carries the token through to the renderer.
  if (ref !== undefined) {
    data[ORIGIN_REF_KEY] = ref;
  }

  const result = revive(serialized.message, data, serialized.isTransient, cause);

  // Replaces the boundary stack captured by the constructor with the real one.
  if (serialized.stack !== undefined) {
    result.stack = serialized.stack;
  }

  return result;
}

/**
 * Rebuild the concrete class for a kind that has one, so instanceof
 * and the accessors those classes declare keep working on an
 * error that crossed a boundary.
 *
 * @deprecated Transitional. Exists so the existing `instanceof` call sites
 * keep working while the codebase moves to branching on `data.kind`. Remove this
 * and the {@link revive} call above once they have.
 */
function reviveClass(message: string, data: VortexErrorData): VortexError | undefined {
  switch (data.kind) {
    case "argument-invalid":
      return new ArgumentInvalid(data.argument);
    case "cycle-error":
      return new CycleError(data.cycles);
    case "data-invalid":
      return new DataInvalid(message);
    case "game-not-found":
      return new GameNotFound(data.gameId);
    case "missing-interpreter":
      return new MissingInterpreter(message, data.url);
    case "not-found":
      return new NotFound(data.resourceType ?? "");
    case "not-supported":
      return new NotSupportedError();
    case "process-canceled":
      return new ProcessCanceled(message, data.extraInfo);
    case "setup-error":
      return new SetupError(message, data.component);
    case "user-canceled":
      return new UserCanceled(data.skipped);
    default:
      return undefined;
  }
}

function revive(
  message: string,
  data: WithRef<VortexErrorData>,
  isTransient: boolean,
  cause: VortexError | undefined,
): VortexError {
  const revived = reviveClass(message, data);
  if (revived === undefined) {
    return new VortexError(message, data, { isTransient, cause });
  }

  // The constructors synthesize their own message and payload, so overwrite both
  // with the wire's — a thrower may have customised the message, and `data`
  // carries the origin-ref token the subclass constructor knows nothing about.
  return Object.assign(revived, { message, data, isTransient, cause });
}

/**
 * Single boundary entry point for the IPC envelope. Takes any thrown value,
 * coerces non-VortexError values through {@link parseError}, and returns the
 * serialized form.
 *
 * Pass `tracker` to carry an error this context owns by reference — the
 * original thrown value (if it was an Error) is captured, so the live object
 * returns on rehydration.
 */
export function toWireError(err: unknown, tracker?: ErrorOriginTracker): SerializedVortexError {
  const vortexErr = err instanceof VortexError ? err : parseError(err);
  const refId =
    tracker !== undefined && err instanceof VortexError ? tracker.capture(err) : undefined;

  const wire = serializeVortexError(vortexErr);

  if (refId !== undefined && tracker !== undefined) {
    wire.data[ORIGIN_REF_KEY] = `${tracker.namespace}:${refId}`;
  }

  return wire;
}
