import type { Pattern } from "./matcher";
import type { QualifiedPath, ResolvedPath } from "./paths";

/** @public */
export interface FileSystem {
  copy(
    source: QualifiedPath,
    target: QualifiedPath,
    options?: { overwrite: boolean },
  ): Promise<void>;

  move(
    source: QualifiedPath,
    target: QualifiedPath,
    options?: { overwrite: boolean },
  ): Promise<void>;

  readFile(path: QualifiedPath): Promise<Uint8Array>;
  writeFile(path: QualifiedPath, contents: Uint8Array): Promise<void>;

  createDirectory(path: QualifiedPath): Promise<void>;

  delete(path: QualifiedPath): Promise<void>;
  deleteRecursive(path: ResolvedPath): Promise<void>;

  stat(
    path: QualifiedPath,
    options?: { parseSymLink: boolean },
  ): Promise<StatResult>;

  enumerateDirectory(
    path: QualifiedPath,
    options?: {
      includeStatus?: false;
      types?: "all" | "files" | "directories";
      recursive?: boolean;
      include?: Pattern;
      exclude?: Pattern;
    },
  ): Promise<AsyncIterator<ResolvedPath>>;

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
  ): Promise<AsyncIterator<QualifiedPath | [QualifiedPath, Status]>>;
}

/** @public */
export interface WebFileSystem extends FileSystem {
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
}

/** @public */
export interface FileSystemBackend {
  copy(
    source: ResolvedPath,
    target: ResolvedPath,
    options?: { overwrite: boolean },
  ): Promise<void>;

  move(
    source: ResolvedPath,
    target: ResolvedPath,
    options?: { overwrite: boolean },
  ): Promise<void>;

  readFile(path: ResolvedPath): Promise<Uint8Array>;
  writeFile(path: ResolvedPath, contents: Uint8Array): Promise<void>;

  createDirectory(path: ResolvedPath): Promise<void>;

  delete(path: ResolvedPath): Promise<void>;
  deleteRecursive(path: ResolvedPath): Promise<void>;

  stat(
    path: ResolvedPath,
    options?: { parseSymLink: boolean },
  ): Promise<StatResult>;

  enumerateDirectory(
    path: ResolvedPath,
    options?: {
      includeStatus?: false;
      types?: "all" | "files" | "directories";
      recursive?: boolean;
      include?: Pattern;
      exclude?: Pattern;
    },
  ): Promise<AsyncIterator<ResolvedPath>>;

  enumerateDirectory(
    path: ResolvedPath,
    options: {
      includeStatus: true | "symlink";
      types?: "all" | "files" | "directories";
      recursive?: boolean;
      include?: Pattern;
      exclude?: Pattern;
    },
  ): Promise<AsyncIterator<[ResolvedPath, Status]>>;

  enumerateDirectory(
    path: ResolvedPath,
    options?: {
      includeStatus?: boolean | "symlink";
      types?: "all" | "files" | "directories";
      recursive?: boolean;
      include?: Pattern;
      exclude?: Pattern;
    },
  ): Promise<AsyncIterator<ResolvedPath | [ResolvedPath, Status]>>;
}

/** @public */
export interface WebFileSystemBackend extends FileSystemBackend {
  createStream(
    path: ResolvedPath,
    mode: "r",
    options?: { start?: number; end?: number },
  ): Promise<ReadableStream>;
  createStream(
    path: ResolvedPath,
    mode: "w",
    options?: { start?: number },
  ): Promise<WritableStream>;

  createStream(
    path: ResolvedPath,
    mode: string,
    options?: { start?: number; end?: number },
  ): Promise<ReadableStream | WritableStream>;
}

/** @public */
export type StatResult =
  | { readonly exists: false }
  | ({ readonly exists: true } & Status);

/** @public */
export type Status = (FileStatus | DirectoryStatus) & SymLinkStatus;

/** @public */
export type StatusTime = {
  // TODO: use Temporal API

  readonly accessTime: bigint;
  readonly modifiedTime: bigint;
  readonly changeTime: bigint;
  readonly creationTime: bigint;
};

/** @public */
export type SymLinkStatus =
  | { readonly isSymLink: false }
  | {
      readonly isSymLink: true;
      readonly symLinkData: SymLinkData;
    };

/** @public */
export type SymLinkData = StatusTime;

/** @public */
export type FileStatus = StatusTime & {
  readonly isFile: true;
  readonly size: number;
  readonly id: bigint;
  readonly deviceId: bigint;
  readonly hardlinkCount: number;
};

/** @public */
export type DirectoryStatus = StatusTime & {
  readonly isFile: false;
  readonly id: bigint;
  readonly deviceId: bigint;
  readonly hardlinkCount: number;
};

/** @public */
export type FileSystemErrorCode =
  | "already exists"
  | "directory not empty"
  | "no permissions"
  | "no space"
  | "not a directory"
  | "not a file"
  | "not found"
  | "generic";

/** @public */
export class FileSystemError extends Error {
  readonly code: FileSystemErrorCode;
  readonly isTransient: boolean;

  /**
   * Creates a new error.
   *
   * Start message with "Failed to" for valid operations with runtime obstacles and "Cannot" for logically invalid operations.
   * (Failed to/Cannot) (verb) (subject): (reason as noun phrase)
   *
   * Example: "Failed to delete '\{path\}': insufficient permissions"
   * Example: "Cannot delete directory '$\{path\}': directory not empty"
   * */
  constructor(
    code: FileSystemErrorCode,
    message: string,
    cause?: unknown,
    isTransient: boolean = false,
  ) {
    super(message, { cause });
    this.name = "FileSystemError";
    this.code = code;
    this.isTransient = isTransient;
  }
}
