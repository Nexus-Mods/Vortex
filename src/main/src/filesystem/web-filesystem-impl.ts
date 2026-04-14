import type {
  FileSystem as NodeFileSystem,
  Pattern,
  QualifiedPath,
  StatResult,
  Status,
  WebFileSystem,
} from "@vortex/fs";
import type { ReadStream, WriteStream } from "node:fs";

import { Readable, Writable } from "node:stream";

/**
 * Web-streams-flavoured {@link WebFileSystem} that wraps a
 * {@link NodeFileSystem}. All flat methods delegate straight through; only
 * `createStream` differs -- it converts the backing Node `ReadStream` /
 * `WriteStream` into `ReadableStream` / `WritableStream` via
 * `Readable.toWeb()` / `Writable.toWeb()`.
 *
 * Use this when the consumer speaks Web Streams (workers, renderers) but
 * the underlying storage is still Node.
 *
 * @public
 */
export class WebFileSystemImpl implements WebFileSystem {
  readonly #node: NodeFileSystem;

  constructor(node: NodeFileSystem) {
    this.#node = node;
  }

  copy(
    source: QualifiedPath,
    target: QualifiedPath,
    options?: { overwrite: boolean },
  ): Promise<void> {
    return this.#node.copy(source, target, options);
  }

  move(
    source: QualifiedPath,
    target: QualifiedPath,
    options?: { overwrite: boolean },
  ): Promise<void> {
    return this.#node.move(source, target, options);
  }

  readFile(path: QualifiedPath): Promise<Uint8Array> {
    return this.#node.readFile(path);
  }

  writeFile(path: QualifiedPath, contents: Uint8Array): Promise<void> {
    return this.#node.writeFile(path, contents);
  }

  createDirectory(path: QualifiedPath): Promise<void> {
    return this.#node.createDirectory(path);
  }

  delete(path: QualifiedPath): Promise<void> {
    return this.#node.delete(path);
  }

  deleteRecursive(path: QualifiedPath): Promise<void> {
    return this.#node.deleteRecursive(path);
  }

  stat(
    path: QualifiedPath,
    options?: { parseSymLink: boolean },
  ): Promise<StatResult> {
    return this.#node.stat(path, options);
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
  ): Promise<AsyncIterator<QualifiedPath>>;
  enumerateDirectory(
    path: QualifiedPath,
    options: {
      includeStatus: true | "symlink";
      types?: "all" | "files" | "directories";
      recursive?: boolean;
      include?: Pattern;
      exclude?: Pattern;
    },
  ): Promise<AsyncIterator<[QualifiedPath, Status]>>;
  enumerateDirectory(
    path: QualifiedPath,
    options?: {
      includeStatus?: boolean | "symlink";
      types?: "all" | "files" | "directories";
      recursive?: boolean;
      include?: Pattern;
      exclude?: Pattern;
    },
  ): Promise<AsyncIterator<QualifiedPath | [QualifiedPath, Status]>> {
    return this.#node.enumerateDirectory(path, options);
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
  async createStream(
    path: QualifiedPath,
    mode: string,
    options?: { start?: number; end?: number },
  ): Promise<ReadableStream | WritableStream> {
    const native = await this.#node.createStream(path, mode, options);
    if (mode === "r") {
      return Readable.toWeb(native as ReadStream) as ReadableStream;
    }
    if (mode === "w") {
      return Writable.toWeb(native as WriteStream) as WritableStream;
    }
    throw new Error(`Unsupported stream mode '${mode}'`);
  }
}
