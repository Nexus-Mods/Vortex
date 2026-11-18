import { getErrorMessageOrDefault } from "@vortex/shared";

import type { ITableAttribute } from "@/types/ITableAttribute";
import { log } from "@/util/log";

/** Who hears of each attribute's data changes, by the attribute whose `externalData` was called. */
const listeners = new WeakMap<ITableAttribute, Set<() => void>>();

/**
 * Has `listener` called as an attribute's `externalData` says the data outside the mods it's from
 * changed, until the function it returns is called. Extensions give no way to stop listening, so
 * `externalData` is called only for the first listener, and later ones share it.
 */
export const listenToExternalData = (
  attribute: ITableAttribute,
  listener: () => void,
): (() => void) => {
  let current = listeners.get(attribute);
  if (current === undefined) {
    const own = new Set<() => void>();
    current = own;
    listeners.set(attribute, own);
    // This set's own, so once released, the extension's call reaches only who's left in it.
    try {
      attribute.externalData?.(() =>
        own.forEach((each) => {
          // Each on its own, so one that fails doesn't keep the others from hearing of it.
          try {
            each();
          } catch (err) {
            log("error", "failed to handle a change to an attribute's data", {
              attribute: attribute.id,
              error: getErrorMessageOrDefault(err),
            });
          }
        }),
      );
    } catch (err) {
      // Forgotten, so the next listener asks the extension again; this one isn't kept in a set
      // nothing reaches, and its caller listens again as its effect runs again.
      listeners.delete(attribute);
      log("error", "failed to listen to an attribute's data", {
        attribute: attribute.id,
        error: getErrorMessageOrDefault(err),
      });
      return () => undefined;
    }
  }
  const added = current;
  added.add(listener);
  return () => {
    added.delete(listener);
  };
};

/**
 * Has an attribute's next listener call its `externalData` again, as the legacy table does as it
 * mounts, taking the listener of an extension that keeps only the last one, such as Tracked's.
 * Those listening already still hear what the extension still tells them.
 */
export const releaseExternalData = (attribute: ITableAttribute) => {
  listeners.delete(attribute);
};
