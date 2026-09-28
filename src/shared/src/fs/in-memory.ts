import type { FileSystem, StatResult, Status } from "./filesystem";
import { InMemoryStore } from "./in-memory-store";
import type { Pattern } from "./matcher";
import type { QualifiedPath } from "./paths";

export class InMemoryFS implements FileSystem {
  readonly #store: InMemoryStore;

  constructor(store: InMemoryStore) {
    this.#store = store;
  }

  copy(
    _source: QualifiedPath,
    _target: QualifiedPath,
    _options?: { overwrite: boolean },
  ): Promise<void> {
    throw new Error("not implemented yet");
  }

  move(
    _source: QualifiedPath,
    _target: QualifiedPath,
    _options?: { overwrite: boolean },
  ): Promise<void> {
    throw new Error("not implemented yet");
  }

  createDirectory(_path: QualifiedPath): Promise<void> {
    throw new Error("not implemented yet");
  }

  delete(_path: QualifiedPath): Promise<void> {
    throw new Error("not implemented yet");
  }

  deleteRecursive(_path: QualifiedPath): Promise<void> {
    throw new Error("not implemented yet");
  }

  createLink(
    _from: QualifiedPath,
    _to: QualifiedPath,
    _type: "hardlink" | "symlink",
  ): Promise<void> {
    throw new Error("not implemented yet");
  }

  writeFile(_path: QualifiedPath, _contents: Uint8Array): Promise<void> {
    throw new Error("not implemented yet");
  }

  readFile(_path: QualifiedPath): Promise<Uint8Array> {
    throw new Error("not implemented yet");
  }

  stat(_path: QualifiedPath, _options?: { parseSymLink: boolean }): Promise<StatResult> {
    throw new Error("not implemented yet");
  }

  enumerateDirectory(
    path: QualifiedPath,
    options?: {
      includeStatus?: false;
      types?: "all" | "files" | "directories";
      recursive?: boolean;
      include?: Pattern;
      exclude?: Pattern;
    },
  ): Promise<AsyncIterator<QualifiedPath, undefined>>;
  enumerateDirectory(
    path: QualifiedPath,
    options: {
      includeStatus: true | "symlink";
      types?: "all" | "files" | "directories";
      recursive?: boolean;
      include?: Pattern;
      exclude?: Pattern;
    },
  ): Promise<AsyncIterator<[QualifiedPath, Status], undefined>>;
  enumerateDirectory(
    path: QualifiedPath,
    options?: {
      includeStatus?: boolean | "symlink";
      types?: "all" | "files" | "directories";
      recursive?: boolean;
      include?: Pattern;
      exclude?: Pattern;
    },
  ): Promise<AsyncIterator<QualifiedPath | [QualifiedPath, Status], undefined>>;
  enumerateDirectory(
    _path: QualifiedPath,
    _options?: {
      includeStatus?: boolean | "symlink";
      types?: "all" | "files" | "directories";
      recursive?: boolean;
      include?: Pattern;
      exclude?: Pattern;
    },
  ): Promise<AsyncIterator<QualifiedPath | [QualifiedPath, Status], undefined>> {
    throw new Error("not implemented yet");
  }

  createStream(
    path: QualifiedPath,
    mode: "r",
    options?: { start?: number; end?: number },
  ): Promise<ReadableStream>;
  createStream(
    path: QualifiedPath,
    mode: "w",
    options?: { start?: number },
  ): Promise<WritableStream>;
  createStream(
    path: QualifiedPath,
    mode: string,
    options?: { start?: number; end?: number },
  ): Promise<ReadableStream | WritableStream>;
  createStream(
    _path: QualifiedPath,
    _mode: string,
    _options?: { start?: number; end?: number },
  ): Promise<ReadableStream | WritableStream> {
    throw new Error("not implemented yet");
  }
}
