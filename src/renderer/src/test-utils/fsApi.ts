import { opendir } from "node:fs/promises";
import * as path from "node:path";

import {
  type FileSystem,
  type InMemoryFS,
  InMemoryFSBuilder,
  QualifiedPath,
} from "@vortex/shared/filesystem";

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

/** Lists a real directory's entries the way main's backend does, by path only. */
async function enumerateDiskDirectory(
  root: QualifiedPath,
  options?: { types?: "all" | "files"; recursive?: boolean },
): Promise<AsyncIterableIterator<QualifiedPath, undefined>> {
  const dir = await opendir(root.path, { recursive: options?.recursive ?? false });
  async function* entries(): AsyncGenerator<QualifiedPath, undefined> {
    for await (const entry of dir) {
      if (options?.types === "files" && !entry.isFile()) continue;
      yield QualifiedPath.fromNative(path.join(entry.parentPath, entry.name));
    }
    return undefined;
  }
  return entries();
}

/** Points `window.api.fs.enumerateDirectory` at the real disk; returns the restore. */
export function installDiskEnumeration(): () => void {
  const previous = window.api;
  const fs = new InMemoryFSBuilder().build();
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- only the path-only overload is used
  fs.enumerateDirectory = enumerateDiskDirectory as FileSystem["enumerateDirectory"];
  window.api = { ...previous, fs };
  return () => {
    window.api = previous;
  };
}
