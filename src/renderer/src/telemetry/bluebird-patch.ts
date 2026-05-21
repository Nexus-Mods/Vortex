import { context } from "@opentelemetry/api";
import Bluebird from "bluebird";

/**
 * Patch Bluebird's .then() to propagate OTel context per-callback.
 * Captures the active context when .then() is called and restores it
 * when the callback actually runs — even across async boundaries.
 *
 * Bluebird bypasses V8's PromiseHook API, so neither AsyncLocalStorage
 * nor Zone.js can track context across Bluebird .then() chains without
 * this patch.
 */
export const patchBluebirdContext = (): void => {
  const originalThen = Bluebird.prototype.then;
  Bluebird.prototype.then = function (
    this: Bluebird<unknown>,
    onFulfilled?: ((...args: any[]) => any) | null,
    onRejected?: ((...args: any[]) => any) | null,
  ) {
    // Bluebird internally calls .then() with undefined handlers (e.g. from
    // .timeout(), .catch()). Bypass wrapping entirely to avoid triggering
    // Bluebird's "only accepts functions" warning, but only for the
    // "no handlers" case. Let Bluebird validate and warn on any other
    // non-function handlers.
    if (arguments.length === 0 || (onFulfilled === undefined && onRejected === undefined)) {
      return originalThen.apply(this, arguments as any);
    }
    const ctx = context.active();
    const wrappedFulfilled =
      typeof onFulfilled === "function"
        ? (...args: any[]) => {
            // If the active context already matches what we captured at
            // .then() call time, context.with() would be a no-op — skip it
            // to avoid nesting AsyncLocalStorage.run() frames during
            // bluebird's synchronous promise drain.
            if (context.active() === ctx) {
              return onFulfilled(...args);
            }
            return context.with(ctx, () => onFulfilled(...args));
          }
        : onFulfilled;
    const wrappedRejected =
      typeof onRejected === "function"
        ? (...args: any[]) => {
            if (context.active() === ctx) {
              return onRejected(...args);
            }
            return context.with(ctx, () => onRejected(...args));
          }
        : onRejected;
    return originalThen.call(this, wrappedFulfilled, wrappedRejected);
  } as typeof originalThen;
};
