import type { IMethodMessage } from "@nexusmods/adaptor-api";

import { getErrorMessage } from "@vortex/shared";

// --- Wire protocol types ---

interface CallMessage {
  type: "call";
  correlationId: string;
  msg: IMethodMessage;
}

interface ResultMessage {
  type: "result";
  correlationId: string;
  value: unknown;
}

/**
 * Structured error envelope. The transport itself is agnostic to the error
 * classes it carries: the sender serialises `name`, `code`, and any extra
 * own enumerable properties (e.g. `FileSystemError.isTransient`); the
 * receiver rehydrates a generic `Error` with those fields copied back, so
 * contract-specific clients (like `@vortex/fs`'s client polyfill) can
 * branch on `err.name` and reconstruct their concrete error type.
 *
 * `cause` chains are serialised recursively up to {@link MAX_CAUSE_DEPTH}
 * levels. Deeper chains (and non-Error causes) are truncated silently to
 * avoid runaway recursion on circular references.
 */
interface SerializedError {
  message: string;
  name?: string;
  code?: string;
  data?: Record<string, unknown>;
  cause?: SerializedError;
}

interface ErrorMessage {
  type: "error";
  correlationId: string;
  message: string;
  errorName?: string;
  errorCode?: string;
  errorData?: Record<string, unknown>;
  cause?: SerializedError;
}

type RpcMessage = CallMessage | ResultMessage | ErrorMessage;

/** Own-property keys that are part of the standard Error surface. */
const STANDARD_ERROR_KEYS = new Set<string>([
  "name",
  "message",
  "stack",
  "cause",
  "code",
]);

/** How many levels of `cause` chain to carry across the wire. */
const MAX_CAUSE_DEPTH = 3;

function extractErrorFields(err: Error): Omit<SerializedError, "cause"> {
  const result: Omit<SerializedError, "cause"> = { message: err.message };
  if (err.name && err.name !== "Error") result.name = err.name;

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

function serializeCause(
  value: unknown,
  depth: number,
): SerializedError | undefined {
  if (depth <= 0) return undefined;
  if (!(value instanceof Error)) return undefined;
  const fields = extractErrorFields(value);
  const nested = serializeCause(
    (value as Error & { cause?: unknown }).cause,
    depth - 1,
  );
  return nested === undefined ? fields : { ...fields, cause: nested };
}

function serialiseError(correlationId: string, err: unknown): ErrorMessage {
  const message = getErrorMessage(err);
  const base: ErrorMessage = { type: "error", correlationId, message };
  if (!(err instanceof Error)) return base;

  const fields = extractErrorFields(err);
  if (fields.name !== undefined) base.errorName = fields.name;
  if (fields.code !== undefined) base.errorCode = fields.code;
  if (fields.data !== undefined) base.errorData = fields.data;

  const cause = serializeCause(
    (err as Error & { cause?: unknown }).cause,
    MAX_CAUSE_DEPTH,
  );
  if (cause !== undefined) base.cause = cause;

  return base;
}

function rehydrateSerializedError(serialized: SerializedError): Error {
  const err = new Error(serialized.message, {
    cause:
      serialized.cause !== undefined
        ? rehydrateSerializedError(serialized.cause)
        : undefined,
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

function deserialiseError(envelope: Record<string, unknown>): Error {
  const message =
    typeof envelope.message === "string" ? envelope.message : "Unknown error";
  const causeValue = envelope.cause;
  const cause =
    causeValue !== undefined && causeValue !== null
      ? rehydrateSerializedError(causeValue as SerializedError)
      : undefined;

  const err = new Error(message, cause !== undefined ? { cause } : undefined);
  if (typeof envelope.errorName === "string") err.name = envelope.errorName;
  if (typeof envelope.errorCode === "string") {
    (err as Error & { code?: string }).code = envelope.errorCode;
  }
  if (envelope.errorData && typeof envelope.errorData === "object") {
    Object.assign(err, envelope.errorData);
  }
  return err;
}

// --- Port abstraction ---

/**
 * Minimal interface satisfied by both Node's `worker_threads.MessagePort`
 * and the browser's `MessagePort`. Both styles of event listener registration
 * are supported.
 */
export interface MessagePortLike {
  postMessage(value: unknown): void;
  // Node-style
  on?(event: "message", listener: (value: unknown) => void): void;
  off?(event: "message", listener: (value: unknown) => void): void;
  // Browser-style (accepts EventListenerOrEventListenerObject for compatibility)
  addEventListener?(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void;
  removeEventListener?(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void;
}

// --- IRpcTransport ---

export interface IRpcTransport {
  /** Send an RPC call and await the response. */
  call(msg: IMethodMessage): Promise<unknown>;
  /** Register the handler for incoming RPC calls. Replaces any previous handler. */
  onCall(handler: (msg: IMethodMessage) => Promise<unknown>): void;
  /** Send a control message (no correlation ID, not an RPC call). */
  send(message: Record<string, unknown>): void;
  /** Await the next control message of the given type. */
  once<T>(type: string): Promise<T>;
  /** Tear down the transport, rejecting all pending calls. */
  dispose(): void;
}

/**
 * Creates a bidirectional RPC transport over a MessagePort.
 *
 * Both sides can initiate calls and handle incoming calls. Correlation IDs
 * of the form `rpc:<n>` pair each call with its response. Pending calls are
 * rejected when dispose() is called.
 */
export function createRpcTransport(port: MessagePortLike): IRpcTransport {
  let counter = 0;
  let callHandler: ((msg: IMethodMessage) => Promise<unknown>) | undefined;
  let disposed = false;

  // Pending outbound calls waiting for a response
  const pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: unknown) => void }
  >();

  // once() listeners keyed by message type
  const onceListeners = new Map<
    string,
    Array<{
      resolve: (value: unknown) => void;
      reject: (reason: unknown) => void;
    }>
  >();

  function handleMessage(data: unknown): void {
    if (typeof data !== "object" || data === null || !("type" in data)) return;

    const envelope = data as Record<string, unknown>;
    const { type } = envelope;

    const correlationId =
      typeof envelope.correlationId === "string"
        ? envelope.correlationId
        : undefined;

    if (type === "call" && correlationId !== undefined) {
      const msg = envelope.msg as IMethodMessage;

      const respond = (response: RpcMessage) => port.postMessage(response);

      if (callHandler == null) {
        respond({
          type: "error",
          correlationId,
          message: "No call handler registered",
        });
        return;
      }

      callHandler(msg).then(
        (value) => respond({ type: "result", correlationId, value }),
        (err: unknown) => {
          respond(serialiseError(correlationId, err));
        },
      );
      return;
    }

    if (type === "result" && correlationId !== undefined) {
      const value = envelope.value;
      const entry = pending.get(correlationId);
      if (entry) {
        pending.delete(correlationId);
        entry.resolve(value);
      }
      return;
    }

    if (type === "error" && correlationId !== undefined) {
      const entry = pending.get(correlationId);
      if (entry) {
        pending.delete(correlationId);
        entry.reject(deserialiseError(envelope));
      }
      return;
    }

    // One-way signal: notify once() waiters
    if (typeof type === "string") {
      const waiters = onceListeners.get(type);
      if (waiters && waiters.length > 0) {
        const waiter = waiters.shift();
        if (waiter) waiter.resolve(data);
      }
    }
  }

  // Normalise over both Node and browser port styles
  let nodeListener: ((value: unknown) => void) | undefined;
  let browserListener: EventListener | undefined;

  if (typeof port.on === "function") {
    nodeListener = (value: unknown) => handleMessage(value);
    port.on("message", nodeListener);
  } else if (typeof port.addEventListener === "function") {
    browserListener = (event: Event) =>
      handleMessage((event as MessageEvent).data);
    port.addEventListener("message", browserListener);
  }

  function removeListeners(): void {
    if (nodeListener && typeof port.off === "function") {
      port.off("message", nodeListener);
    }
    if (browserListener && typeof port.removeEventListener === "function") {
      port.removeEventListener("message", browserListener);
    }
  }

  return {
    call(msg: IMethodMessage): Promise<unknown> {
      if (disposed) {
        return Promise.reject(new Error("transport disposed"));
      }
      const correlationId = `rpc:${++counter}`;
      return new Promise((resolve, reject) => {
        pending.set(correlationId, { resolve, reject });
        port.postMessage({
          type: "call",
          correlationId,
          msg,
        } satisfies CallMessage);
      });
    },

    onCall(handler: (msg: IMethodMessage) => Promise<unknown>): void {
      callHandler = handler;
    },

    send(message: Record<string, unknown>): void {
      port.postMessage(message);
    },

    once<T>(type: string): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const list = onceListeners.get(type) ?? [];
        list.push({ resolve: resolve as (value: unknown) => void, reject });
        onceListeners.set(type, list);
      });
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      removeListeners();

      const error = new Error("transport disposed");
      for (const { reject } of pending.values()) {
        reject(error);
      }
      pending.clear();
      for (const waiters of onceListeners.values()) {
        for (const { reject } of waiters) {
          reject(error);
        }
      }
      onceListeners.clear();
    },
  };
}
