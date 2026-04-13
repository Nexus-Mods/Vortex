import type { IMethodMessage } from "@vortex/adaptor-api";

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

interface ErrorMessage {
  type: "error";
  correlationId: string;
  message: string;
}

type RpcMessage = CallMessage | ResultMessage | ErrorMessage;

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
  addEventListener?(type: string, listener: EventListenerOrEventListenerObject): void;
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

    const correlationId = typeof envelope.correlationId === "string" ? envelope.correlationId : undefined;

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
          const message = getErrorMessage(err);
          respond({ type: "error", correlationId, message });
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
      const message = typeof envelope.message === "string" ? envelope.message : "Unknown error";
      const entry = pending.get(correlationId);
      if (entry) {
        pending.delete(correlationId);
        entry.reject(new Error(message));
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
    browserListener = (event: Event) => handleMessage((event as MessageEvent).data);
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
