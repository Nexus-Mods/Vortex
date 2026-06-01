// Symmetric Error <-> wire codec for moving errors across the IPC boundary.
// Electron's structured-clone serializer already carries an Error's
// name/message/stack/cause, but it drops own-enumerable properties and the
// concrete prototype. This pair closes both gaps:
//   - the generic path preserves the standard fields, the `cause` chain, and any
//     own properties, rehydrating as a base Error;
//   - registered error classes round-trip through an explicit codec so they keep
//     their real prototype and any fields exposed only through getters.
// Keep this the single place that knows how to (de)serialize errors; both ends
// of the boundary import from here.

import { DownloadError, HTTPError } from "./types/errors";
import type { DownloadErrorPayload } from "./types/errors";
import type { Serializable, WireError } from "./types/ipc";

/** Standard fields handled explicitly; never copied as generic properties. */
const RESERVED_KEYS = new Set(["name", "message", "stack", "cause"]);

/** Guard against pathological or cyclic `cause` chains. */
const MAX_CAUSE_DEPTH = 8;

/** Built-in error constructors we can rehydrate into by name. */
const BUILTIN_ERRORS: { [name: string]: new (message?: string) => Error } = {
  Error,
  EvalError,
  RangeError,
  ReferenceError,
  SyntaxError,
  TypeError,
  URIError,
};

/**
 * Per-class codec for an error whose public shape can't be reconstructed by
 * copying own-enumerable properties — typically because the data lives behind
 * getters over private fields, or needs constructor arguments.
 */
type ErrorCodec<E extends Error> = {
  /** Concrete class, used to match instances when serializing. */
  type: abstract new (...args: never[]) => E;
  /** Structured data to carry beyond name/message/stack. */
  toWire: (err: E) => { [key: string]: Serializable };
  /** Rebuild the concrete error from the wire payload (stack/cause are
   *  re-applied by {@link deserializeError} afterwards). */
  fromWire: (wire: WireError) => E;
};

const CODECS = new Map<string, ErrorCodec<Error>>();

function defineCodec<E extends Error>(name: string, codec: ErrorCodec<E>): void {
  CODECS.set(name, codec as unknown as ErrorCodec<Error>);
}

// --- Registered Vortex error classes ----------------------------------------

defineCodec<HTTPError>("HTTPError", {
  type: HTTPError,
  toWire: (err) => ({
    statusCode: err.statusCode,
    statusMessage: err.statusMessage,
    url: err.url,
  }),
  fromWire: (wire) => {
    const props = wire.properties ?? {};
    const statusCode = typeof props.statusCode === "number" ? props.statusCode : 0;
    const statusMessage = typeof props.statusMessage === "string" ? props.statusMessage : "";
    const url = typeof props.url === "string" ? props.url : "";
    return new HTTPError(statusCode, statusMessage, url);
  },
});

defineCodec<DownloadError>("DownloadError", {
  type: DownloadError,
  toWire: (err) => ({ payload: wirifyDownloadPayload(err.payload) }),
  fromWire: (wire) =>
    new DownloadError(dewirifyDownloadPayload(wire.properties?.payload), wire.message),
});

// The payload carries a `URL`, which is not part of the IPC `Serializable`
// contract, so it travels as a string and is rebuilt on arrival.
function wirifyDownloadPayload(payload: DownloadErrorPayload): Serializable {
  if ("url" in payload) {
    return { ...payload, url: payload.url.toString() };
  }
  return { ...payload };
}

function dewirifyDownloadPayload(raw: Serializable | undefined): DownloadErrorPayload {
  const obj = (raw ?? { code: "resolver-error" }) as Record<string, unknown>;
  if (typeof obj.url === "string") {
    return { ...obj, url: new URL(obj.url) } as DownloadErrorPayload;
  }
  return obj as DownloadErrorPayload;
}

// --- Public API --------------------------------------------------------------

/**
 * Convert any thrown value into its wire representation. Non-Error throwables
 * are coerced to a minimal `{ name, message }`.
 */
export function serializeError(value: unknown, depth = 0): WireError {
  if (!(value instanceof Error)) {
    return { name: "Error", message: typeof value === "string" ? value : safeString(value) };
  }

  const codec = findCodec(value);
  const properties = codec ? codec.toWire(value) : collectOwnProperties(value);

  const wire: WireError = { name: value.name, message: value.message };
  if (value.stack !== undefined) wire.stack = value.stack;
  if (Object.keys(properties).length > 0) wire.properties = properties;

  const cause = (value as { cause?: unknown }).cause;
  if (cause !== undefined && depth < MAX_CAUSE_DEPTH) {
    wire.cause = serializeError(cause, depth + 1);
  }

  return wire;
}

/**
 * Rebuild an Error from its wire representation. Registered Vortex classes
 * regain their real prototype; built-in errors are matched by name; everything
 * else becomes a base Error carrying the same properties.
 */
export function deserializeError(wire: WireError): Error {
  const codec = CODECS.get(wire.name);

  let err: Error;
  if (codec) {
    err = codec.fromWire(wire);
  } else {
    const Ctor = BUILTIN_ERRORS[wire.name] ?? Error;
    err = new Ctor(wire.message);
    err.name = wire.name;
    if (wire.properties) Object.assign(err, wire.properties);
  }

  if (wire.stack !== undefined) err.stack = wire.stack;
  if (wire.cause !== undefined) {
    (err as { cause?: unknown }).cause = deserializeError(wire.cause);
  }

  return err;
}

// --- Internals ---------------------------------------------------------------

function findCodec(err: Error): ErrorCodec<Error> | undefined {
  for (const codec of CODECS.values()) {
    if (err instanceof codec.type) return codec;
  }
  return undefined;
}

function collectOwnProperties(err: Error): { [key: string]: Serializable } {
  const out: { [key: string]: Serializable } = {};
  const record = err as unknown as Record<string, unknown>;
  for (const key of Object.keys(err)) {
    if (RESERVED_KEYS.has(key)) continue;
    out[key] = record[key] as Serializable;
  }
  return out;
}

function safeString(value: unknown): string {
  try {
    return String(value);
  } catch {
    return "unknown error";
  }
}
