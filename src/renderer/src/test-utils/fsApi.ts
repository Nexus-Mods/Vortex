import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { parseError } from "@vortex/shared";
import {
  type FileSystem,
  type InMemoryFS,
  InMemoryFSBuilder,
  NativePathResolver,
  type QualifiedPath,
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

/**
 * Replaces `window.api.fs` with one that reads and writes the real disk, for suites whose
 * subject also reaches the disk through node and so cannot run against an {@link InMemoryFS}.
 *
 * Only the whole-file operations are there (`readFile`, `writeFile`, `move`, `delete`), with
 * the errors the main-process backend would raise for them.
 */
export function installDiskFS(): { restore: () => void } {
  const previous = window.api;
  const resolver = new NativePathResolver();

  const onDisk = async <T>(
    target: QualifiedPath,
    operation: (nativePath: string) => Promise<T>,
  ): Promise<T> => {
    const nativePath = await resolver.resolve(target);
    try {
      return await operation(nativePath);
    } catch (err) {
      throw parseError(err, { path: nativePath });
    }
  };

  const disk: Pick<FileSystem, "readFile" | "writeFile" | "move" | "delete"> = {
    readFile: (target) => onDisk(target, (nativePath) => readFile(nativePath)),
    writeFile: (target, contents) =>
      onDisk(target, async (nativePath) => {
        await mkdir(path.dirname(nativePath), { recursive: true });
        await writeFile(nativePath, contents);
      }),
    move: (source, target) =>
      onDisk(source, async (nativePath) => rename(nativePath, await resolver.resolve(target))),
    delete: (target) => onDisk(target, (nativePath) => rm(nativePath)),
  };

  // the operations left out are ones no disk-bound suite has needed yet
  window.api = { ...previous, fs: disk as FileSystem };

  return {
    restore: () => {
      window.api = previous;
    },
  };
}
