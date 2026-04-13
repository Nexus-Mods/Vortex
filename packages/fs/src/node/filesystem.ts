import type { ReadStream, WriteStream } from "node:fs";

import type { FileSystem, FileSystemBackend } from "../browser/filesystem";
import type { QualifiedPath, ResolvedPath } from "../browser/paths";

/** @public */
export interface NodeFileSystem extends FileSystem {
  createStream(
    path: QualifiedPath,
    mode: "r",
    options?: { start?: number; end?: number },
  ): Promise<ReadStream>;
  createStream(
    path: QualifiedPath,
    mode: "w",
    options?: { start?: number },
  ): Promise<WriteStream>;

  createStream(
    path: QualifiedPath,
    mode: string,
    options?: { start?: number; end?: number },
  ): Promise<WriteStream | ReadStream>;

  createLink(
    from: QualifiedPath,
    to: QualifiedPath,
    type: "hardlink" | "symlink",
  ): Promise<void>;
}

/** @public */
export interface NodeFileSystemBackend extends FileSystemBackend {
  createStream(
    path: ResolvedPath,
    mode: "r",
    options?: { start?: number; end?: number },
  ): Promise<ReadStream>;
  createStream(
    path: ResolvedPath,
    mode: "w",
    options?: { start?: number },
  ): Promise<WriteStream>;
  createStream(
    path: ResolvedPath,
    mode: string,
    options?: { start?: number; end?: number },
  ): Promise<WriteStream | ReadStream>;

  createLink(
    from: ResolvedPath,
    to: ResolvedPath,
    type: "hardlink" | "symlink",
  ): Promise<void>;
}
