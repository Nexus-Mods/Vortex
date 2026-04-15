import { PathProviderError, QualifiedPath } from "@vortex/fs";

import type {
  Base,
  OS,
  StorePathProvider,
  StorePathSnapshot,
} from "./providers";

/**
 * Wraps a {@link StorePathSnapshot} received over IPC into a
 * {@link StorePathProvider}.
 *
 * `structuredClone` strips the {@link QualifiedPath} prototype off the
 * values that crossed the wire, so this factory walks the nested map
 * and reparses each value into a real `QualifiedPath` instance.
 *
 * @public */
export function createStorePathProvider(
  snapshot: StorePathSnapshot,
): StorePathProvider {
  const rebuilt = new Map<OS, Map<Base, QualifiedPath>>();
  for (const [os, bases] of snapshot.bases) {
    const inner = new Map<Base, QualifiedPath>();
    for (const [base, value] of bases) {
      inner.set(base, rehydrate(value));
    }
    rebuilt.set(os, inner);
  }

  return {
    store: snapshot.store,
    baseOS: snapshot.baseOS,
    gameOS: snapshot.gameOS,
    fromBase(base: Base, os: OS = snapshot.gameOS): Promise<QualifiedPath> {
      const forOS = rebuilt.get(os);
      if (!forOS) {
        return Promise.reject(
          new PathProviderError(
            `StorePathProvider has no bases resolved for OS "${os}"`,
          ),
        );
      }
      const resolved = forOS.get(base);
      if (!resolved) {
        return Promise.reject(
          new PathProviderError(
            `StorePathProvider has no "${base}" base for OS "${os}"`,
          ),
        );
      }
      return Promise.resolve(resolved);
    },
  };
}

/**
 * Rebuilds a {@link QualifiedPath} instance from a structured-clone'd
 * plain object. Accepts an already-hydrated instance and returns it
 * unchanged.
 */
function rehydrate(value: QualifiedPath): QualifiedPath {
  if (value instanceof QualifiedPath) return value;
  // After structured clone the prototype is gone but `value` still has
  // the `.value` property that QualifiedPath.parse accepts.
  const raw = (value as { value?: string }).value;
  if (typeof raw !== "string") {
    throw new PathProviderError(
      "StorePathSnapshot contained a non-QualifiedPath value",
    );
  }
  return QualifiedPath.parse(raw);
}
