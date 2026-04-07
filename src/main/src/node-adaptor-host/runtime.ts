import type { IMethodMessage } from "@vortex/adaptor-api/interfaces";
import type { MessageId, PID } from "@vortex/adaptor-api/branded";
import { messageId, pid } from "@vortex/adaptor-api/branded";

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
 * Creates a dispatcher that routes IMethodMessage calls to methods on a
 * service instance. Throws if the requested method does not exist.
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

    const res = fn.apply(instance, msg.args);
    return Promise.resolve(res as unknown);
  };
}
