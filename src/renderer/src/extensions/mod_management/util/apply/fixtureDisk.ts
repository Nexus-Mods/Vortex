import {
  InMemoryFS,
  InMemoryFSBuilder,
  QualifiedPath,
  type FileSystem,
  type InMemoryStore,
  type StatResult,
  type Status,
} from "@vortex/shared/filesystem";

import type { JournalStorage } from "./journal";

/** The folder every fixture path is in. */
const FIXTURE_ROOT = "/fixture-root";

/** A disk as fixtures write it. */
export interface FixtureDisk {
  /** contents by path; paths with the same contents are hardlinks of one file */
  files: Record<string, string>;
  /** the folders that hold nothing; those above a file are implied */
  folders?: string[];
}

const qualified = (path: string) => QualifiedPath.fromNative(path);

/** An in-memory store holding a fixture's files and folders. */
export async function fixtureStore({ files, folders = [] }: FixtureDisk): Promise<InMemoryStore> {
  const builder = new InMemoryFSBuilder();
  for (const folder of folders) {
    builder.dir(qualified(folder));
  }
  const fs = builder.build();
  /** by contents */
  const firstPaths = new Map<string, QualifiedPath>();
  for (const [path, contents] of Object.entries(files)) {
    const first = firstPaths.get(contents);
    if (first === undefined) {
      builder.file(qualified(path), { type: "text", data: contents });
      firstPaths.set(contents, qualified(path));
    } else {
      builder.dir(qualified(path).parent());
      await fs.createLink(first, qualified(path), "hardlink");
    }
  }
  return builder.store;
}

/** The disk as fixtures write it. */
export async function snapshotOf(fs: FileSystem): Promise<FixtureDisk> {
  const listing = await fs.enumerateDirectory(qualified(FIXTURE_ROOT), {
    includeStatus: "symlink",
    recursive: true,
  });
  const entries: [path: QualifiedPath, isFile: boolean][] = [];
  for await (const [entryPath, status] of listing) {
    entries.push([entryPath, status.isFile]);
  }
  entries.sort(([lhs], [rhs]) => (lhs.path < rhs.path ? -1 : 1));

  const files: Record<string, string> = {};
  const folders: string[] = [];
  for (const [entryPath, isFile] of entries) {
    if (isFile) {
      files[entryPath.path] = new TextDecoder().decode(await fs.readFile(entryPath));
    } else if (!entries.some(([other]) => other.path.startsWith(`${entryPath.path}/`))) {
      folders.push(entryPath.path);
    }
  }
  return folders.length > 0 ? { files, folders } : { files };
}

type Guard = <T>(call: () => Promise<T>) => Promise<T>;

type EnumerateOptions = NonNullable<Parameters<FileSystem["enumerateDirectory"]>[1]>;

/** InMemoryFS with every call Apply makes passed through `guarded`. */
class KillableFS extends InMemoryFS {
  readonly #guarded: Guard;

  constructor(store: InMemoryStore, guarded: Guard) {
    super(store);
    this.#guarded = guarded;
  }

  override stat(path: QualifiedPath, options?: { parseSymLink: boolean }): Promise<StatResult> {
    return this.#guarded(() => super.stat(path, options));
  }

  override move(
    source: QualifiedPath,
    target: QualifiedPath,
    options?: { overwrite: boolean },
  ): Promise<void> {
    return this.#guarded(() => super.move(source, target, options));
  }

  override createLink(
    from: QualifiedPath,
    to: QualifiedPath,
    type: "hardlink" | "symlink",
  ): Promise<void> {
    return this.#guarded(() => super.createLink(from, to, type));
  }

  override delete(path: QualifiedPath): Promise<void> {
    return this.#guarded(() => super.delete(path));
  }

  override deleteRecursive(path: QualifiedPath): Promise<void> {
    return this.#guarded(() => super.deleteRecursive(path));
  }

  override createDirectory(path: QualifiedPath): Promise<void> {
    return this.#guarded(() => super.createDirectory(path));
  }

  override enumerateDirectory(
    path: QualifiedPath,
    options?: EnumerateOptions & { includeStatus?: false },
  ): Promise<AsyncIterableIterator<QualifiedPath, undefined>>;
  override enumerateDirectory(
    path: QualifiedPath,
    options: EnumerateOptions & { includeStatus: true | "symlink" },
  ): Promise<AsyncIterableIterator<[QualifiedPath, Status], undefined>>;
  override enumerateDirectory(
    path: QualifiedPath,
    options?: EnumerateOptions,
  ): Promise<AsyncIterableIterator<QualifiedPath | [QualifiedPath, Status], undefined>>;
  override enumerateDirectory(
    path: QualifiedPath,
    options?: EnumerateOptions,
  ): Promise<AsyncIterableIterator<QualifiedPath | [QualifiedPath, Status], undefined>> {
    return this.#guarded(() => super.enumerateDirectory(path, options));
  }
}

/** Every file and journal call after the first `calls` fails, as in a killed process. */
export function killAfter(calls: number): {
  fs: (store: InMemoryStore) => FileSystem;
  journal: (journal: JournalStorage) => JournalStorage;
  callsUsed: () => number;
} {
  let used = 0;
  const guarded: Guard = async (call) => {
    if (used++ >= calls) {
      throw new Error("killed");
    }
    return call();
  };
  return {
    fs: (store) => new KillableFS(store, guarded),
    journal: (journal) => ({
      read: () => guarded(() => journal.read()),
      create: (contents) => guarded(() => journal.create(contents)),
      write: (contents) => guarded(() => journal.write(contents)),
      append: async (contents) => {
        // the kill tears the line it lands on
        if (used === calls) {
          await journal.append(contents.subarray(0, contents.length >> 1));
        }
        return guarded(() => journal.append(contents));
      },
      remove: () => guarded(() => journal.remove()),
      close: () => guarded(() => journal.close()),
    }),
    callsUsed: () => used,
  };
}
