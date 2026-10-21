import { type InMemoryFS, InMemoryFSBuilder } from "@vortex/shared/filesystem";

export type InstalledInMemoryFS = {
  fs: InMemoryFS;
  restore: () => void;
};

/**
 * Replaces `window.api.fs` with an {@link InMemoryFS} for renderer tests.
 *
 * Only the `fs` member is swapped; every other `window.api` member is left
 * alone when one is already present. Call `restore()` (or the suite's
 * save/restore pattern) to put the previous state back.
 *
 * @param seed Optional builder seeding, called before `build()`.
 */
export function installInMemoryFS(
  seed?: (builder: InMemoryFSBuilder) => void,
): InstalledInMemoryFS {
  const previous = window.api;

  const builder = new InMemoryFSBuilder();
  seed?.(builder);
  const fs = builder.build();

  window.api = { ...previous, fs };

  return {
    fs,
    restore: () => {
      window.api = previous;
    },
  };
}
