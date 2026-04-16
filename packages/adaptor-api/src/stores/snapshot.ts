import { PathProviderError, QualifiedPath } from "@vortex/fs";

import {
  OS,
  type Base,
  type LinuxStorePathProvider,
  type StorePathProvider,
  type StorePathSnapshot,
  type WindowsStorePathProvider,
} from "./providers";

/**
 * Wraps a {@link StorePathSnapshot} received over IPC into a
 * {@link StorePathProvider}.
 *
 * `structuredClone` strips the {@link QualifiedPath} prototype off the
 * values that crossed the wire, so this factory walks the nested map
 * and reparses each value into a real `QualifiedPath` instance.
 *
 * Called by the worker dispatch layer before invoking adaptor methods;
 * adaptors receive the resulting {@link StorePathProvider} directly.
 *
 * @internal */
export function createStorePathProvider(
  snapshot: StorePathSnapshot,
): StorePathProvider {
  const rebuilt = new Map<
    (typeof OS)[keyof typeof OS],
    Map<Base, QualifiedPath>
  >();
  for (const [os, bases] of snapshot.bases) {
    const inner = new Map<Base, QualifiedPath>();
    for (const [base, value] of bases) {
      inner.set(base, rehydrate(value));
    }
    rebuilt.set(os, inner);
  }

  function fromBase(
    base: Base,
    os: (typeof OS)[keyof typeof OS] = snapshot.gameOS,
  ): Promise<QualifiedPath> {
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
  }

  if (snapshot.gameOS === OS.Windows) {
    return {
      store: snapshot.store,
      baseOS: snapshot.baseOS,
      gameOS: OS.Windows,
      isWindows: true as const,
      fromBase,
    } as WindowsStorePathProvider;
  }

  return {
    store: snapshot.store,
    baseOS: snapshot.baseOS,
    gameOS: OS.Linux,
    isWindows: false as const,
    fromBase,
  } as LinuxStorePathProvider;
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
