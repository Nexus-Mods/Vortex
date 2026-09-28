import { VortexError } from "../errors/base";
import type { DirectoryStatus, FileStatus, FileSystem, StatResult, Status } from "./filesystem";
import type { Node, DirNode, FileNode, SymlinkNode, WalkFailure } from "./in-memory-store";
import { DEFAULT_TIMES, InMemoryStore, MAX_SYMLINK_DEPTH } from "./in-memory-store";
import { matches, type Pattern } from "./matcher";
import type { QualifiedPath } from "./paths";

export class InMemoryFS implements FileSystem {
  readonly #store: InMemoryStore;

  constructor(store: InMemoryStore) {
    this.#store = store;
  }

  async copy(
    source: QualifiedPath,
    target: QualifiedPath,
    options?: { overwrite: boolean },
  ): Promise<void> {
    const lookup = this.#store.lookup(source);
    if (!lookup.ok) return throwFsFailure(lookup.failure);

    const clone = this.#cloneSubtree(lookup.node);
    const attached = this.#store.attach(target, clone, { overwrite: options?.overwrite });
    if (!attached.ok) return throwFsFailure(attached.failure);
  }

  async move(
    source: QualifiedPath,
    target: QualifiedPath,
    options?: { overwrite: boolean },
  ): Promise<void> {
    const overwrite = options?.overwrite ?? false;

    // Pre-check the target before detaching the source: a failed move must
    // never lose the source.
    const existing = this.#store.lookup(target, { parseSymLink: true });
    if (existing.ok) {
      if (!overwrite || target.path === target.root) {
        return throwFsFailure({ type: "target-exists", path: target });
      }
    } else if (existing.failure.type !== "missing-entry") {
      return throwFsFailure(existing.failure);
    } else {
      const parent = this.#store.lookup(target.parent());
      if (!parent.ok) return throwFsFailure(parent.failure);
      if (parent.node.type !== "dir") {
        throw new VortexError(`Cannot move to '${target.value}': parent is not a directory`, {
          kind: "fs:not-a-directory",
          path: target.value,
        });
      }
    }

    const detached = this.#store.detach(source);
    if (!detached.ok) return throwFsFailure(detached.failure);

    detached.node.name = target.basename;
    const attached = this.#store.attach(target, detached.node, { overwrite });
    if (!attached.ok) {
      this.#store.attach(source, detached.node, { overwrite: true });
      return throwFsFailure(attached.failure);
    }
  }

  async createDirectory(path: QualifiedPath): Promise<void> {
    const ensured = this.#store.ensureDirectory(path);
    if (!ensured.ok) return throwFsFailure(ensured.failure);
  }

  async delete(path: QualifiedPath): Promise<void> {
    const removed = this.#store.removeEntry(path);
    if (!removed.ok) return throwFsFailure(removed.failure);
  }

  async deleteRecursive(path: QualifiedPath): Promise<void> {
    const detached = this.#store.detach(path);
    if (!detached.ok) return throwFsFailure(detached.failure);
  }

  async createLink(
    from: QualifiedPath,
    to: QualifiedPath,
    type: "hardlink" | "symlink",
  ): Promise<void> {
    if (type === "hardlink") {
      // link() does not follow symlinks: it links the entry itself
      const lookup = this.#store.lookup(from, { parseSymLink: true });
      if (!lookup.ok) return throwFsFailure(lookup.failure);

      const attached = this.#store.attach(to, lookup.node);
      if (!attached.ok) return throwFsFailure(attached.failure);
      return;
    }

    if (type === "symlink") {
      // symlink() does not require the target to exist: dangling links are fine
      const node = {
        type: "symlink",
        id: this.#store.nextId(),
        name: to.basename,
        times: { ...DEFAULT_TIMES },
        target: from,
      } satisfies SymlinkNode;

      const attached = this.#store.attach(to, node);
      if (!attached.ok) return throwFsFailure(attached.failure);
      return;
    }

    const exhausted: never = type;
    throw new Error(
      `Cannot create link from '${from.value}' to '${to.value}': unknown type '${String(exhausted)}'`,
    );
  }

  async writeFile(path: QualifiedPath, contents: Uint8Array): Promise<void> {
    const { target, existing } = this.#writeTarget(path);

    if (existing !== undefined) {
      if (existing.type !== "file") {
        throw new VortexError(`Cannot write to '${target.value}': not a file`, {
          kind: "fs:not-a-file",
          path: target.value,
        });
      }

      existing.contents = contents;
      existing.times = {
        ...existing.times,
        modifiedTime: DEFAULT_TIMES.modifiedTime,
        changeTime: DEFAULT_TIMES.changeTime,
      };

      return;
    }

    const node = {
      type: "file",
      id: this.#store.nextId(),
      name: target.basename,
      times: { ...DEFAULT_TIMES },
      contents,
    } satisfies FileNode;

    const attached = this.#store.attach(target, node);
    if (!attached.ok) return throwFsFailure(attached.failure);
  }

  async readFile(path: QualifiedPath): Promise<Uint8Array> {
    const lookup = this.#store.lookup(path);
    if (!lookup.ok) return throwFsFailure(lookup.failure);

    const node = lookup.node;
    if (node.type !== "file") {
      throw new VortexError(`Cannot read '${path.value}': not a file`, {
        kind: "fs:not-a-file",
        path: path.value,
      });
    }

    return node.contents;
  }

  async stat(path: QualifiedPath, options?: { parseSymLink: boolean }): Promise<StatResult> {
    const lookup = this.#store.lookup(path, { parseSymLink: options?.parseSymLink ?? false });
    if (!lookup.ok) {
      if (lookup.failure.type === "missing-entry") return { exists: false };
      return throwFsFailure(lookup.failure);
    }

    const node = lookup.node;
    if (node.type !== "symlink") {
      return { exists: true, isSymLink: false, ...statusOf(node) };
    }

    const resolved = this.#store.lookup(node.target);
    if (!resolved.ok) {
      if (resolved.failure.type === "missing-entry") return { exists: false };
      return throwFsFailure(resolved.failure);
    }

    return {
      exists: true,
      isSymLink: true,
      symLinkData: node.times,
      ...statusOf(resolved.node),
    } satisfies StatResult;
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
  async enumerateDirectory(
    path: QualifiedPath,
    options?: {
      includeStatus?: boolean | "symlink";
      types?: "all" | "files" | "directories";
      recursive?: boolean;
      include?: Pattern;
      exclude?: Pattern;
    },
  ): Promise<AsyncIterator<QualifiedPath | [QualifiedPath, Status], undefined>> {
    const resolved = this.#store.lookup(path);
    if (!resolved.ok) return throwFsFailure(resolved.failure);

    if (resolved.node.type !== "dir") {
      throw new VortexError(`Cannot enumerate '${path.value}': not a directory`, {
        kind: "fs:not-a-directory",
        path: path.value,
      });
    }

    return this.#visit(resolved.node, path, options ?? {});
  }

  async *#visit(
    node: DirNode,
    nodePath: QualifiedPath,
    options: {
      includeStatus?: boolean | "symlink";
      types?: "all" | "files" | "directories";
      recursive?: boolean;
      include?: Pattern;
      exclude?: Pattern;
    },
  ): AsyncGenerator<QualifiedPath | [QualifiedPath, Status], undefined, undefined> {
    for (const child of node.children.values()) {
      const childPath = nodePath.join(child.name);

      const filtered =
        (options.types === "files" && child.type !== "file") ||
        (options.types === "directories" && child.type !== "dir") ||
        (options.include !== undefined && !matches(childPath.value, options.include)) ||
        (options.exclude !== undefined && matches(childPath.value, options.exclude));

      if (!filtered) {
        const withStatus = options.includeStatus ?? false;
        if (!withStatus) {
          yield childPath;
        } else {
          const status = await this.stat(childPath, { parseSymLink: withStatus === "symlink" });
          if (status.exists) yield [childPath, status];
        }
      }

      if (options.recursive === true && child.type === "dir") {
        yield* this.#visit(child, childPath, options);
      }
    }
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
    if (mode === "r") {
      const lookup = this.#store.lookup(path);
      if (!lookup.ok) return throwFsFailure(lookup.failure);

      const node = lookup.node;
      if (node.type !== "file") {
        throw new VortexError(`Cannot create stream for '${path.value}': not a file`, {
          kind: "fs:not-a-file",
          path: path.value,
        });
      }

      const bytes = node.contents;
      const start = options?.start ?? 0;
      const end = options?.end === undefined ? bytes.length : options.end + 1;

      return new ReadableStream({
        start(controller) {
          controller.enqueue(bytes.slice(start, end));
          controller.close();
        },
      });
    }

    if (mode === "w") {
      const { target, existing } = this.#writeTarget(path);

      if (existing !== undefined && existing.type !== "file") {
        throw new VortexError(`Cannot create stream for '${target.value}': not a file`, {
          kind: "fs:not-a-file",
          path: target.value,
        });
      }

      let node: FileNode;
      if (existing !== undefined) {
        node = existing;
        node.contents = new Uint8Array(0);
        node.times = {
          ...node.times,
          modifiedTime: DEFAULT_TIMES.modifiedTime,
          changeTime: DEFAULT_TIMES.changeTime,
        };
      } else {
        node = {
          type: "file",
          id: this.#store.nextId(),
          name: target.basename,
          times: { ...DEFAULT_TIMES },
          contents: new Uint8Array(0),
        } satisfies FileNode;

        const attached = this.#store.attach(target, node);
        if (!attached.ok) return throwFsFailure(attached.failure);
      }

      let committed = new Uint8Array(options?.start ?? 0);
      node.contents = committed;

      return new WritableStream<Uint8Array>({
        write(chunk) {
          const merged = new Uint8Array(committed.length + chunk.length);
          merged.set(committed);
          merged.set(chunk, committed.length);
          committed = merged;
          node.contents = merged;
        },
      });
    }

    throw new Error(`Cannot create stream for '${path.value}': unknown mode '${mode}'`);
  }

  /**
   * Deep-clones a node and its whole subtree with fresh ids. File contents
   * are copied by value; a hardlink inside the copied tree splits into
   * independent nodes, matching `cp` behavior.
   */
  #cloneSubtree(node: Node): Node {
    if (node.type === "file") {
      return {
        type: "file",
        id: this.#store.nextId(),
        name: node.name,
        times: { ...node.times },
        contents: node.contents.slice(),
      };
    }

    if (node.type === "symlink") {
      return {
        type: "symlink",
        id: this.#store.nextId(),
        name: node.name,
        times: { ...node.times },
        target: node.target,
      };
    }

    const children = new Map<string, Node>();
    for (const [key, child] of node.children) {
      children.set(key, this.#cloneSubtree(child));
    }

    return {
      type: "dir",
      id: this.#store.nextId(),
      name: node.name,
      times: { ...node.times },
      children,
    };
  }

  #writeTarget(path: QualifiedPath): { target: QualifiedPath; existing: Node | undefined } {
    let current = path;
    for (let depth = 0; ; depth++) {
      if (depth > MAX_SYMLINK_DEPTH) {
        throw new VortexError(`Symlink loop while writing '${path.value}'`, {
          kind: "os:generic",
          originalCode: "ELOOP",
        });
      }

      const entry = this.#store.lookup(current, { parseSymLink: true });
      if (!entry.ok) {
        if (entry.failure.type !== "missing-entry") return throwFsFailure(entry.failure);

        const parent = this.#store.lookup(current.parent());
        if (!parent.ok) return throwFsFailure(parent.failure);
        if (parent.node.type !== "dir") {
          throw new VortexError(`Cannot write to '${current.value}': parent is not a directory`, {
            kind: "fs:not-a-directory",
            path: current.value,
          });
        }

        return { target: current, existing: undefined };
      }

      const node = entry.node;
      if (node.type !== "symlink") return { target: current, existing: node };
      current = node.target;
    }
  }
}

/**
 * Maps store failure data to a thrown {@link VortexError}, the behavior half
 * of the in-memory fs.
 */
function throwFsFailure(failure: WalkFailure): never {
  const path = failure.path.value;
  switch (failure.type) {
    case "missing-entry":
      throw new VortexError(`Path '${path}' does not exist`, { kind: "fs:not-found", path });
    case "not-a-directory":
      throw new VortexError(`Path '${path}' is not a directory`, {
        kind: "fs:not-a-directory",
        path,
      });
    case "not-empty":
      throw new VortexError(`Directory at '${path}' is not empty`, {
        kind: "fs:directory-not-empty",
        path,
      });
    case "no-parent":
      throw new VortexError(`Path '${path}' has no parent entry`, {
        kind: "fs:invalid-path",
        path,
      });
    case "target-exists":
      throw new VortexError(`Path '${path}' already exists`, {
        kind: "fs:already-exists",
        path,
      });
    case "symlink-loop":
      throw new VortexError(`Symlink loop at '${path}'`, {
        kind: "os:generic",
        originalCode: "ELOOP",
      });
  }
}

/** Derives the {@link StatResult} status fields for a node. */
function statusOf(node: Node): FileStatus | DirectoryStatus {
  if (node.type === "file") {
    return {
      isFile: true,
      size: node.contents.length,
      id: node.id,
      deviceId: 0n,
      hardlinkCount: 1,
      ...node.times,
    } satisfies FileStatus;
  }

  return {
    isFile: false,
    id: node.id,
    deviceId: 0n,
    hardlinkCount: 1,
    ...node.times,
  } satisfies DirectoryStatus;
}
