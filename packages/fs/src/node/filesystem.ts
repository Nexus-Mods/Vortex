import type { BigIntStats, ReadStream, WriteStream } from "node:fs";

import {
  cp,
  link,
  lstat,
  mkdir,
  open,
  opendir,
  readFile,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join, dirname } from "node:path";

import type {
  DirectoryStatus,
  FileStatus,
  FileSystem,
  FileSystemBackend,
  FileSystemErrorCode,
  StatResult,
  Status,
  StatusTime,
} from "../browser/filesystem";
import type { Pattern } from "../browser/matcher";
import type { QualifiedPath, ResolvedPath } from "../browser/paths";

import { FileSystemError } from "../browser/filesystem";
import { matches } from "../browser/matcher";

function parseNodeError(err: unknown): {
  code: FileSystemErrorCode;
  isTransient: boolean;
  originalCode: string;
} {
  if (!(err instanceof Error)) {
    return { code: "generic", isTransient: false, originalCode: "" };
  }

  // https://nodejs.org/api/errors.html
  // NOTE(erri120): Node.js is inconsistent when it comes to data on Errors.
  // The error code that we care about is on err.info.code or err.code if err.info doesn't exist

  if (!("code" in err) || typeof err.code !== "string") {
    return { code: "generic", isTransient: false, originalCode: "" };
  }

  const originalCode =
    "info" in err &&
    typeof err.info === "object" &&
    err.info !== null &&
    "code" in err.info &&
    typeof err.info.code === "string"
      ? err.info.code
      : err.code;

  // NOTE(erri120): Node.js uses POSIX error names as codes
  // https://www.man7.org/linux/man-pages/man3/errno.3.html
  // https://nodejs.org/api/errors.html#common-system-errors
  if (originalCode === "EACCES" || originalCode === "EPERM") {
    // EACCES: Permission denied (POSIX.1-2001).
    // EPERM: Operation not permitted (POSIX.1-2001).
    return { code: "no permissions", isTransient: false, originalCode };
  } else if (originalCode === "ENOENT") {
    // ENOENT: No such file or directory (POSIX.1-2001).
    return { code: "not found", isTransient: false, originalCode };
  } else if (originalCode === "EEXIST") {
    // EEXIST: File exists (POSIX.1-2001).
    return { code: "already exists", isTransient: false, originalCode };
  } else if (originalCode === "ENOSPC") {
    // ENOSPC: No space left on device (POSIX.1-2001)
    return { code: "no space", isTransient: false, originalCode };
  } else if (originalCode === "ENOTDIR") {
    // ENOTDIR: Not a directory (POSIX.1-2001).
    return { code: "not a directory", isTransient: false, originalCode };
  } else if (originalCode === "EISDIR") {
    // EISDIR: Is a directory (POSIX.1-2001).
    return { code: "not a file", isTransient: false, originalCode };
  } else if (originalCode === "ENOTEMPTY") {
    // ENOTEMPTY: Directory not empty (POSIX.1-2001).
    return { code: "directory not empty", isTransient: false, originalCode };
  } else if (originalCode === "EMFILE" || originalCode === "EBUSY") {
    // EMFILE: Too many open files (POSIX.1-2001).
    // EBUSY: Device or resource busy (POSIX.1-2001)
    return { code: "generic", isTransient: true, originalCode };
  } else {
    return { code: "generic", isTransient: false, originalCode };
  }
}

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

/** @public */
export class RealFileSystemBackend implements NodeFileSystemBackend {
  async copy(
    source: ResolvedPath,
    target: ResolvedPath,
    options?: { overwrite: boolean },
  ): Promise<void> {
    try {
      await cp(source, target, {
        recursive: true,
        force: options?.overwrite ?? false,
        errorOnExist: true,
      });
    } catch (err) {
      const { code, isTransient } = parseNodeError(err);
      let message = `Failed to copy '${source}' to '${target}'`;
      if (code === "no permissions") {
        message = `Failed to copy '${source}' to '${target}': insufficient permissions`;
      } else if (code === "not found") {
        message = `Failed to copy '${source}': source does not exist`;
      } else if (code === "no space") {
        message = `Failed to copy '${source}' to '${target}': no space left`;
      } else if (code === "already exists") {
        message = `Cannot copy '${source}' to '${target}': target already exists`;
      } else if (code === "not a file") {
        message = `Cannot copy '${source}' to '${target}': source is a directory but target is a file`;
      } else if (code === "not a directory") {
        message = `Cannot copy '${source}' to '${target}': source is a file but target is a directory`;
      }

      throw new FileSystemError(code, message, err, isTransient);
    }
  }

  async move(
    source: ResolvedPath,
    target: ResolvedPath,
    options?: { overwrite: boolean },
  ): Promise<void> {
    // NOTE(erri120): The `rename` operation has two quirks:
    // 1) Will silently overwrite the target if it already exists
    // 2) Can't rename across devices
    // Both quirks are undesired in this API.
    // The first quirk can't be changed reliably. This method does a stat
    // before the rename but this obviously has the potential of a TOCTOU bug.
    // This is acceptable for now, nothing much we can do here.
    // The second quirk is more easily changed, we catch the EXDEV error and
    // do a manual cp + rm. The goal for the API is simplicity and consumers
    // shouldn't have to care about device boundaries.

    const overwrite = options?.overwrite ?? false;
    if (!overwrite) {
      let targetExists = false;

      try {
        await stat(target);
        targetExists = true;
      } catch (err) {
        const { code } = parseNodeError(err);
        targetExists = code === "not found";
      }

      if (targetExists) {
        throw new FileSystemError(
          "already exists",
          `Cannot move '${source}' to '${target}': target already exists`,
        );
      }
    }

    try {
      await rename(source, target);
    } catch (err) {
      const { code, isTransient, originalCode } = parseNodeError(err);
      if (originalCode === "EXDEV") {
        // EXDEV: Invalid cross-device link (POSIX.1-2001).
        // NOTE(erri120): Can't rename between devices, need to do cp + rm here.

        await this.copy(source, target, { overwrite });
        await this.deleteRecursive(source);
        return;
      }

      let message = `Failed to move '${source}' to '${target}'`;
      if (code === "no permissions") {
        message = `Failed to copy '${source}' to '${target}': insufficient permissions`;
      } else if (code === "not found") {
        message = `Failed to copy '${source}': source does not exist`;
      }

      throw new FileSystemError(code, message, err, isTransient);
    }
  }

  async createDirectory(path: ResolvedPath): Promise<void> {
    try {
      await mkdir(path, { recursive: true });
    } catch (err) {
      const { code, isTransient } = parseNodeError(err);
      let message = `Failed to create directory at '${path}'`;
      if (code === "no permissions") {
        message = `Failed to create directory at '${path}': insufficient permissions`;
      } else if (code === "not a directory") {
        message = `Cannot create directory at '${path}': path component is a file`;
      }

      throw new FileSystemError(code, message, err, isTransient);
    }
  }

  async delete(path: ResolvedPath): Promise<void> {
    try {
      await rm(path, { recursive: false });
    } catch (err) {
      const { code, isTransient } = parseNodeError(err);
      let message = `Failed to delete '${path}'`;
      if (code === "no permissions") {
        message = `Failed to delete '${path}': insufficient permissions`;
      } else if (code === "not found") {
        message = `Failed to delete '${path}': path does not exist`;
      } else if (code === "directory not empty") {
        message = `Cannot delete directory at '${path}': directory not empty`;
      }

      throw new FileSystemError(code, message, err, isTransient);
    }
  }

  async deleteRecursive(path: ResolvedPath): Promise<void> {
    try {
      await rm(path, { recursive: true });
    } catch (err) {
      const { code, isTransient } = parseNodeError(err);
      let message = `Failed to delete '${path}' recursively`;
      if (code === "no permissions") {
        message = `Failed to delete '${path}' recursively: insufficient permissions`;
      } else if (code === "not found") {
        message = `Failed to delete '${path}' recursively: path does not exist`;
      }

      throw new FileSystemError(code, message, err, isTransient);
    }
  }

  async readFile(path: ResolvedPath): Promise<Uint8Array> {
    try {
      const buffer = await readFile(path);
      return buffer;
    } catch (err) {
      const { code, isTransient } = parseNodeError(err);
      let message = `Failed to read file '${path}'`;
      if (code === "no permissions") {
        message = `Failed to read file '${path}': insufficient permissions`;
      } else if (code === "not found") {
        message = `Failed to read file '${path}': file does not exist`;
      } else if (code === "not a file") {
        message = `Cannot read '${path}': not a file`;
      }

      throw new FileSystemError(code, message, err, isTransient);
    }
  }

  async writeFile(path: ResolvedPath, contents: Uint8Array): Promise<void> {
    await this.createDirectory(dirname(path));

    try {
      await writeFile(path, contents);
    } catch (err) {
      const { code, isTransient } = parseNodeError(err);
      let message = `Failed to write to file '${path}'`;
      if (code === "no permissions") {
        message = `Failed to write to file '${path}': insufficient permissions`;
      } else if (code === "no space") {
        message = `Failed to write to file '${path}': no space left`;
      } else if (code === "not a file") {
        message = `Cannot write to '${path}': not a file`;
      }

      throw new FileSystemError(code, message, err, isTransient);
    }
  }

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
  async createStream(
    path: ResolvedPath,
    mode: string,
    options?: { start?: number; end?: number },
  ): Promise<ReadStream | WriteStream> {
    if (mode === "w") {
      await this.createDirectory(dirname(path));
    }

    try {
      if (mode === "r") {
        // 'r': Open file for reading. An exception occurs if the file does not exist.
        const fd = await open(path, "r");
        return fd.createReadStream({
          autoClose: true,
          start: options?.start,
          end: options?.end,
        });
      } else if (mode === "w") {
        // 'w': Open file for writing. The file is created (if it does not exist) or truncated (if it exists).
        const fd = await open(path, "w");
        return fd.createWriteStream({
          autoClose: true,
          start: options?.start,
        });
      }
    } catch (err) {
      const { code, isTransient } = parseNodeError(err);
      let message = `Failed to create stream for '${path}'`;

      if (code === "no permissions") {
        message = `Failed to create stream for file '${path}': insufficient permissions`;
      } else if (code === "not found") {
        message = `Failed to create read stream for file '${path}': file does not exist`;
      } else if (code === "not a file") {
        message = `Cannot create stream for '${path}': not a file`;
      }

      throw new FileSystemError(code, message, err, isTransient);
    }

    throw new Error(
      `Cannot create stream for '${path}': unknown mode'${mode}'`,
    );
  }

  async stat(
    path: ResolvedPath,
    options?: { parseSymLink: boolean },
  ): Promise<StatResult> {
    const parseSymLink = options?.parseSymLink ?? false;

    try {
      if (parseSymLink) {
        const entryStats = await lstat(path, { bigint: true });
        if (!entryStats.isSymbolicLink()) {
          return {
            exists: true,
            isSymLink: false,
            ...parseNodeStats(path, entryStats),
          };
        }

        const linkedEntryStats = await stat(path, { bigint: true });

        return {
          ...parseNodeStats(path, linkedEntryStats),
          exists: true,
          isSymLink: true,
          symLinkData: parseTime(entryStats),
        };
      } else {
        const entryStats = await stat(path, { bigint: true });
        return {
          exists: true,
          isSymLink: false,
          ...parseNodeStats(path, entryStats),
        };
      }
    } catch (err) {
      const { code, isTransient } = parseNodeError(err);
      if (code === "not found") {
        return { exists: false };
      }

      throw new FileSystemError(
        code,
        `Failed to start ${path}`,
        err,
        isTransient,
      );
    }
  }

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

  async enumerateDirectory(
    path: ResolvedPath,
    options?: {
      includeStatus?: boolean | "symlink";
      types?: "all" | "files" | "directories";
      recursive?: boolean;
      include?: Pattern;
      exclude?: Pattern;
    },
  ): Promise<AsyncIterator<ResolvedPath | [ResolvedPath, Status]>> {
    const recursive = options?.recursive ?? false;
    const include = options?.include;
    const exclude = options?.exclude;
    const includeStatus = options?.includeStatus;
    const parseSymLinks = includeStatus === "symlink";
    const types = options?.types;

    const dir = await opendir(path, { recursive });

    return {
      next: async () => {
        while (true) {
          const entry = await dir.read();
          if (entry === null) return { done: true, value: undefined };

          if (types === "files" && !entry.isFile()) continue;
          if (types === "directories" && !entry.isDirectory()) continue;

          const resolvedPath: ResolvedPath = join(entry.parentPath, entry.name);
          if (include && !matches(resolvedPath, include)) continue;
          if (exclude && matches(resolvedPath, exclude)) continue;

          if (!includeStatus) return { done: false, value: resolvedPath };

          const status = await this.stat(resolvedPath, {
            parseSymLink: parseSymLinks,
          });

          if (!status.exists) continue;
          return { done: false, value: [resolvedPath, status] };
        }
      },
    };
  }

  async createLink(
    from: ResolvedPath,
    to: ResolvedPath,
    type: "hardlink" | "symlink",
  ): Promise<void> {
    if (type === "hardlink") {
      await link(from, to);
      return;
    } else if (type === "symlink") {
      await symlink(from, to, null);
      return;
    }

    const exhausted: never = type;
    throw new Error(
      `Cannot create link from '${from}' to '${to}': unknown type '${exhausted as string}'`,
    );
  }
}

function parseTime(stats: BigIntStats) {
  const times: StatusTime = {
    accessTime: stats.atimeNs,
    modifiedTime: stats.mtimeNs,
    changeTime: stats.ctimeNs,
    creationTime: stats.birthtimeNs,
  };

  return times;
}

function parseNodeStats(
  path: ResolvedPath,
  stats: BigIntStats,
): FileStatus | DirectoryStatus {
  const times = parseTime(stats);

  if (stats.isFile()) {
    const bigSize = stats.size;
    if (bigSize > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new FileSystemError(
        "generic",
        `Cannot stat '${path}': file size exceeds maximum supported size`,
      );
    }

    const size = Number(bigSize);

    const result = {
      isFile: true,
      size,
      id: stats.ino,
      deviceId: stats.dev,
      hardlinkCount: Number(stats.nlink),
      ...times,
    } satisfies FileStatus;

    return result;
  } else {
    const result = {
      isFile: false,
      id: stats.ino,
      deviceId: stats.dev,
      hardlinkCount: Number(stats.nlink),
      ...times,
    } satisfies DirectoryStatus;

    return result;
  }
}
