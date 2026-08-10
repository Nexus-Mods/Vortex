import type { BigIntStats } from "node:fs";
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
import { Readable, Writable } from "node:stream";

import type {
  DirectoryStatus,
  FileStatus,
  StatResult,
  Status,
  StatusTime,
} from "@nexusmods/adaptor-api/fs";
import type { Pattern, ResolvedPath } from "@nexusmods/adaptor-api/fs";
import type { FileSystemBackend as NodeFileSystemBackend } from "@nexusmods/adaptor-api/fs";
import { matches } from "@nexusmods/adaptor-api/fs";
import { parseError, VortexError } from "@vortex/shared";

/**
 * Node-backed implementation of {@link NodeFileSystemBackend}. Operates on
 * native {@link ResolvedPath} values; path resolution from
 * {@link QualifiedPath} is the responsibility of the {@link FileSystem}
 * that wraps this backend.
 *
 * @public
 */
export class NodeFileSystemBackendImpl implements NodeFileSystemBackend {
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
      throw parseError(err, { path: source }, ({ data }) => {
        if (data.kind === "fs:no-permissions") {
          return `Failed to copy '${source}' to '${target}': insufficient permissions`;
        } else if (data.kind === "fs:not-found") {
          return `Failed to copy '${source}': source does not exist`;
        } else if (data.kind === "fs:no-space") {
          return `Failed to copy '${source}' to '${target}': no space left`;
        } else if (data.kind === "fs:already-exists") {
          return `Cannot copy '${source}' to '${target}': target already exists`;
        } else if (data.kind === "fs:not-a-file") {
          return `Cannot copy '${source}' to '${target}': source is a directory but target is a file`;
        } else if (data.kind === "fs:not-a-directory") {
          return `Cannot copy '${source}' to '${target}': source is a file but target is a directory`;
        }

        return undefined;
      });
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
      let targetExists: boolean;

      try {
        await stat(target);
        targetExists = true;
      } catch (err) {
        targetExists = parseError(err, { path: target }).data.kind !== "fs:not-found";
      }

      if (targetExists) {
        throw new VortexError(`Cannot move '${source}' to '${target}': target already exists`, {
          kind: "fs:already-exists",
          path: target,
        });
      }
    }

    try {
      await rename(source, target);
    } catch (err) {
      const parsed = parseError(err, { path: source });
      if (parsed.data.kind === "os:generic" && parsed.data.originalCode === "EXDEV") {
        // EXDEV: Invalid cross-device link (POSIX.1-2001).
        // NOTE(erri120): Can't rename between devices, need to do cp + rm here.

        await this.copy(source, target, { overwrite });
        await this.deleteRecursive(source);
        return;
      }

      if (parsed.data.kind === "fs:no-permissions") {
        parsed.message = `Failed to move '${source}' to '${target}': insufficient permissions`;
      } else if (parsed.data.kind === "fs:not-found") {
        parsed.message = `Failed to move '${source}': source does not exist`;
      }
      throw parsed;
    }
  }

  async createDirectory(path: ResolvedPath): Promise<void> {
    try {
      await mkdir(path, { recursive: true });
    } catch (err) {
      throw parseError(err, { path }, ({ data }) => {
        if (data.kind === "fs:no-permissions") {
          return `Failed to create directory at '${path}': insufficient permissions`;
        } else if (data.kind === "fs:not-a-directory") {
          return `Cannot create directory at '${path}': path component is a file`;
        }
        return undefined;
      });
    }
  }

  async delete(path: ResolvedPath): Promise<void> {
    try {
      await rm(path, { recursive: false });
    } catch (err) {
      throw parseError(err, { path }, ({ data }) => {
        if (data.kind === "fs:no-permissions") {
          return `Failed to delete '${path}': insufficient permissions`;
        } else if (data.kind === "fs:not-found") {
          return `Failed to delete '${path}': path does not exist`;
        } else if (data.kind === "fs:directory-not-empty") {
          return `Cannot delete directory at '${path}': directory not empty`;
        }
        return undefined;
      });
    }
  }

  async deleteRecursive(path: ResolvedPath): Promise<void> {
    try {
      await rm(path, { recursive: true });
    } catch (err) {
      throw parseError(err, { path }, ({ data }) => {
        if (data.kind === "fs:no-permissions") {
          return `Failed to delete '${path}' recursively: insufficient permissions`;
        } else if (data.kind === "fs:not-found") {
          return `Failed to delete '${path}' recursively: path does not exist`;
        }
        return undefined;
      });
    }
  }

  async readFile(path: ResolvedPath): Promise<Uint8Array> {
    try {
      const buffer = await readFile(path);
      return buffer;
    } catch (err) {
      throw parseError(err, { path }, ({ data }) => {
        if (data.kind === "fs:no-permissions") {
          return `Failed to read file '${path}': insufficient permissions`;
        } else if (data.kind === "fs:not-found") {
          return `Failed to read file '${path}': file does not exist`;
        } else if (data.kind === "fs:not-a-file") {
          return `Cannot read '${path}': not a file`;
        }
        return undefined;
      });
    }
  }

  async writeFile(path: ResolvedPath, contents: Uint8Array): Promise<void> {
    await this.createDirectory(dirname(path));

    try {
      await writeFile(path, contents);
    } catch (err) {
      throw parseError(err, { path }, ({ data }) => {
        if (data.kind === "fs:no-permissions") {
          return `Failed to write to file '${path}': insufficient permissions`;
        } else if (data.kind === "fs:no-space") {
          return `Failed to write to file '${path}': no space left`;
        } else if (data.kind === "fs:not-a-file") {
          return `Cannot write to '${path}': not a file`;
        }
        return undefined;
      });
    }
  }

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
  async createStream(
    path: ResolvedPath,
    mode: string,
    options?: { start?: number; end?: number },
  ): Promise<ReadableStream | WritableStream> {
    if (mode === "w") {
      await this.createDirectory(dirname(path));
    }

    try {
      if (mode === "r") {
        // 'r': Open file for reading. An exception occurs if the file does not exist.
        const fd = await open(path, "r");
        const node = fd.createReadStream({
          autoClose: true,
          start: options?.start,
          end: options?.end,
        });
        return Readable.toWeb(node) as ReadableStream;
      } else if (mode === "w") {
        // 'w': Open file for writing. The file is created (if it does not exist) or truncated (if it exists).
        const fd = await open(path, "w");
        const node = fd.createWriteStream({
          autoClose: true,
          start: options?.start,
        });
        return Writable.toWeb(node) as WritableStream;
      }
    } catch (err) {
      throw parseError(err, { path }, ({ data }) => {
        if (data.kind === "fs:no-permissions") {
          return `Failed to create stream for file '${path}': insufficient permissions`;
        } else if (data.kind === "fs:not-found") {
          return `Failed to create read stream for file '${path}': file does not exist`;
        } else if (data.kind === "fs:not-a-file") {
          return `Cannot create stream for '${path}': not a file`;
        }
        return undefined;
      });
    }

    throw new Error(`Cannot create stream for '${path}': unknown mode'${mode}'`);
  }

  async stat(path: ResolvedPath, options?: { parseSymLink: boolean }): Promise<StatResult> {
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
      const parsed = parseError(err, { path }, () => `Failed to stat ${path}`);
      if (parsed.data.kind === "fs:not-found") {
        return { exists: false };
      }
      throw parsed;
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
  ): Promise<AsyncIterator<ResolvedPath, undefined>>;
  enumerateDirectory(
    path: ResolvedPath,
    options: {
      includeStatus: true | "symlink";
      types?: "all" | "files" | "directories";
      recursive?: boolean;
      include?: Pattern;
      exclude?: Pattern;
    },
  ): Promise<AsyncIterator<[ResolvedPath, Status], undefined>>;
  enumerateDirectory(
    path: ResolvedPath,
    options?: {
      includeStatus?: boolean | "symlink";
      types?: "all" | "files" | "directories";
      recursive?: boolean;
      include?: Pattern;
      exclude?: Pattern;
    },
  ): Promise<AsyncIterator<ResolvedPath | [ResolvedPath, Status], undefined>>;
  async enumerateDirectory(
    path: ResolvedPath,
    options?: {
      includeStatus?: boolean | "symlink";
      types?: "all" | "files" | "directories";
      recursive?: boolean;
      include?: Pattern;
      exclude?: Pattern;
    },
  ): Promise<AsyncIterator<ResolvedPath | [ResolvedPath, Status], undefined>> {
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
      return: async () => {
        await dir.close().catch(() => undefined);
        return { done: true, value: undefined };
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

function parseTime(stats: BigIntStats): StatusTime {
  const times: StatusTime = {
    accessTime: stats.atimeNs,
    modifiedTime: stats.mtimeNs,
    changeTime: stats.ctimeNs,
    creationTime: stats.birthtimeNs,
  };

  return times;
}

function parseNodeStats(path: ResolvedPath, stats: BigIntStats): FileStatus | DirectoryStatus {
  const times = parseTime(stats);

  if (stats.isFile()) {
    const bigSize = stats.size;
    if (bigSize > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new VortexError(`Cannot stat '${path}': file size exceeds maximum supported size`, {
        kind: "data-invalid",
      });
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
