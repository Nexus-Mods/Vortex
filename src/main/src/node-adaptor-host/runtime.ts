import type { IMethodMessage, MessageId, PID } from "@vortex/adaptor-api";
import type { StorePathSnapshot } from "@vortex/adaptor-api/stores/lib";

import { messageId, pid } from "@vortex/adaptor-api";
import { createStorePathProvider } from "@vortex/adaptor-api/stores/lib";

/**
 * Creates a closure-based PID allocator. Each call returns a unique PID.
 */
export function createPidAllocator(): () => PID {
  let counter = 0;
  return () => pid(`pid:${++counter}`);
}

/**
 * Creates a closure-based message ID allocator. Each call returns a unique MessageId.
 */
export function createMessageIdAllocator(): () => MessageId {
  let counter = 0;
  return () => messageId(`msg:${++counter}`);
}

/** Signature for the send function used by service proxies. */
export type SendFn = (msg: IMethodMessage) => Promise<unknown>;

/**
 * Creates a Proxy-based service stub that translates method calls into
 * IMethodMessage objects dispatched via the given send function.
 * Returns undefined for `then` so `await proxy` does not trigger thenable unwrapping.
 */
export function createServiceProxy<T extends object>(
  uri: string,
  send: SendFn,
): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      if (typeof prop === "symbol" || prop === "then" || prop === "toJSON") {
        return undefined;
      }
      return async (...args: unknown[]) => send({ uri, method: prop, args });
    },
  });
}

/**
 * Returns `true` if `arg` looks like a {@link StorePathSnapshot} that
 * crossed the IPC boundary. The shape is distinctive enough (nested
 * `Map` plus `store`/`baseOS`/`gameOS` strings) that false positives
 * are not a concern for any other arg type in the adaptor system.
 */
function isSnapshotLike(arg: unknown): arg is StorePathSnapshot {
  if (typeof arg !== "object" || arg === null) return false;
  const obj = arg as Record<string, unknown>;
  return (
    obj.bases instanceof Map &&
    typeof obj.store === "string" &&
    typeof obj.baseOS === "string" &&
    typeof obj.gameOS === "string"
  );
}

/**
 * Replaces any {@link StorePathSnapshot}-shaped arg with a
 * {@link StorePathProvider} so adaptor methods receive providers
 * directly, without needing to call `createStorePathProvider` themselves.
 */
function transformArgs(args: unknown[]): unknown[] {
  return args.map((arg) =>
    isSnapshotLike(arg) ? createStorePathProvider(arg) : arg,
  );
}

/**
 * Creates a dispatcher that routes IMethodMessage calls to methods on a
 * service instance. Throws if the requested method does not exist.
 *
 * Before calling the method, any {@link StorePathSnapshot} args are
 * automatically wrapped into {@link StorePathProvider}s so adaptors
 * never need to handle the IPC transport detail themselves.
 */
export function createMethodDispatcher(
  uri: string,
  instance: Record<string, (...args: unknown[]) => unknown>,
): (msg: IMethodMessage) => Promise<unknown> {
  return (msg: IMethodMessage) => {
    const fn = instance[msg.method];
    if (typeof fn !== "function") {
      throw new Error(`No method "${msg.method}" on service ${uri}`);
    }

    const res = fn.apply(instance, transformArgs(msg.args));
    return Promise.resolve(res as unknown);
  };
}
