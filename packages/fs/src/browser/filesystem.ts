import type { Pattern } from "./matcher";
import type { QualifiedPath, ResolvedPath } from "./paths";

/**
 * Filesystem operations.
 *
 * @public */
export interface FileSystem {
  /**
   * Copies a file or a directory.
   *
   * @param source - Source path to copy.
   * @param target - Target path to copy to.
   * @param options - Whether to overwrite the target path if it already exists. Otherwise throws.
   *
   * @throws {@link FileSystemError}
   * */
  copy(
    source: QualifiedPath,
    target: QualifiedPath,
    options?: { overwrite: boolean },
  ): Promise<void>;

  /**
   * Moves a file or directory. The source path will be copied and
   * removed if the source and target are on different devices.
   *
   * @param source - Source path to move.
   * @param target - Target path to move to.
   * @param options - Whether to overwrite the target path if it already exists. Otherwise throws.
   *
   * @throws {@link FileSystemError}
   * */
  move(
    source: QualifiedPath,
    target: QualifiedPath,
    options?: { overwrite: boolean },
  ): Promise<void>;

  /** Reads data from a file.
   *
   * @throws {@link FileSystemError}
   * */
  readFile(path: QualifiedPath): Promise<Uint8Array>;

  /**
   * Writes data from a file.
   *
   * @throws {@link FileSystemError}
   * */
  writeFile(path: QualifiedPath, contents: Uint8Array): Promise<void>;

  /**
   * Creates a directory and all parent directories.
   *
   * @throws {@link FileSystemError}
   * */
  createDirectory(path: QualifiedPath): Promise<void>;

  /**
   * Deletes a file or an empty directory.
   *
   * @throws {@link FileSystemError}
   * */
  delete(path: QualifiedPath): Promise<void>;

  /**
   * Deletes a file or a directory recursively.
   *
   * @throws {@link FileSystemError}
   * */
  deleteRecursive(path: QualifiedPath): Promise<void>;

  /**
   * Returns the status of the entry.
   *
   * @param path - Path to query.
   * @param options - Whether to parse sym links explicilty or silently follow them.
   *
   * @throws {@link FileSystemError}
   * */
  stat(
    path: QualifiedPath,
    options?: { parseSymLink: boolean },
  ): Promise<StatResult>;

  /**
   * Returns an async iterator to enumerate the directory.
   *
   * @param path - Directory to enumerate.
   * @param options - Configures the enumeration.
   *
   * @throws {@link FileSystemError}
   * */
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

  /**
   * Returns an async iterator to enumerate the directory.
   *
   * @param path - Directory to enumerate.
   * @param options - Configures the enumeration.
   *
   * @throws {@link FileSystemError}
   * */
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

  /**
   * Returns an async iterator to enumerate the directory.
   *
   * @param path - Directory to enumerate.
   * @param options - Configures the enumeration.
   *
   * @throws {@link FileSystemError}
   * */
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

/**
 * Filesystem APIs extended with Web-safe methods and types.
 * @public */
export interface WebFileSystem extends FileSystem {
  /**
   * Creates a readable stream.
   *
   * @throws {@link FileSystemError}
   * */
  createStream(
    path: QualifiedPath,
    mode: "r",
    options?: { start?: number; end?: number },
  ): Promise<ReadableStream>;

  /**
   * Creates a writable stream.
   *
   * @throws {@link FileSystemError}
   * */
  createStream(
    path: QualifiedPath,
    mode: "w",
    options?: { start?: number },
  ): Promise<WritableStream>;

  /**
   * Creates a stream.
   *
   * @throws {@link FileSystemError}
   * */
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

  /** Time in nanoseconds when entry data was last accessed. */
  readonly accessTime: bigint;

  /** Time in nanoseconds when entry data was last modified. */
  readonly modifiedTime: bigint;

  /** Time in nanoseconds when entry status was last changed. */
  readonly changeTime: bigint;

  /** Time in nanoseconds when entry was created. */
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

  /**
   * Whether the root error cause is transient. Example: too many open files.
   *
   * This property can be used for retry logic but it make assumptions about
   * the retryablility of the operation that caused the error.
   * */
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
