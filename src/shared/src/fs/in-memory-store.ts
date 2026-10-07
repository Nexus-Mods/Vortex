import type { StatusTime } from "./filesystem";
import type { QualifiedPath } from "./paths";

export type NodeBase = {
  readonly id: bigint;
  name: string;
  times: StatusTime;
};

export type FileNode = NodeBase & {
  readonly type: "file";
  contents: Uint8Array;
};

export type DirNode = NodeBase & {
  readonly type: "dir";
  children: Map<string, Node>;
};

export type SymlinkNode = NodeBase & {
  readonly type: "symlink";
  target: QualifiedPath;
};

export type Node = FileNode | DirNode | SymlinkNode;

/**
 * Neutral failure data returned by the store instead of thrown errors.
 * The FS layer maps these to `VortexError` kinds.
 */
export type WalkFailure =
  | { type: "missing-entry"; path: QualifiedPath }
  | { type: "not-a-directory"; path: QualifiedPath }
  | { type: "not-empty"; path: QualifiedPath }
  | { type: "no-parent"; path: QualifiedPath }
  | { type: "target-exists"; path: QualifiedPath }
  | { type: "symlink-loop"; path: QualifiedPath };

export type LookupSuccess = {
  readonly ok: true;
  readonly node: Node;
  readonly parent: DirNode;
  readonly key: string;
};

export type LookupResult = LookupSuccess | { readonly ok: false; readonly failure: WalkFailure };

export type EnsureDirectoryResult =
  | { readonly ok: true; readonly dir: DirNode }
  | { readonly ok: false; readonly failure: WalkFailure };

export type AttachResult =
  | { readonly ok: true; readonly parent: DirNode }
  | { readonly ok: false; readonly failure: WalkFailure };

export type DetachResult =
  | { readonly ok: true; readonly node: Node }
  | { readonly ok: false; readonly failure: WalkFailure };

export type RemoveEntryResult =
  | { readonly ok: true; readonly node: Node }
  | { readonly ok: false; readonly failure: WalkFailure };

export class InMemoryStore {
  readonly #roots: Map<string, DirNode> = new Map();
  #nextId: bigint = 1n;

  /**
   * Resolves a {@link QualifiedPath} to the node stored at it.
   *
   * Returns `{ ok: true, node, parent, key }` when the path exists:
   *
   * - `node` is the entry stored at the path
   * - `parent` is the directory containing the entry and `key` is the
   *   lowercased key under which it is stored in `parent.children`; both can
   *   be used to mutate or remove the entry in place
   * - resolving the root of a store partition (a path with no components
   *   past its root span) returns the root directory as `node` with itself
   *   as `parent` and `key = ""`, since roots have no parent entry
   *
   * Returns `{ ok: false, failure }` when the path cannot be resolved:
   *
   * - `symlink-loop`: more than {@link MAX_SYMLINK_DEPTH} links were
   *   followed while resolving the path
   * - `missing-entry`: no root entry exists for the path's root span, or a
   *   component of the path does not exist
   * - `not-a-directory`: a component that must be a directory to continue
   *   the walk is a file
   *
   * Symlinks are always followed in intermediate components. The final
   * component is followed as well unless `parseSymLink` is set, in which
   * case the {@link SymlinkNode} itself is returned (lstat semantics).
   *
   * @param path - Path to resolve.
   * @param options - Whether to stop at a final symlink instead of
   *   following it.
   */
  lookup(path: QualifiedPath, options?: { parseSymLink?: boolean }): LookupResult {
    const parseSymLink = options?.parseSymLink ?? false;
    return this.#resolve(path, parseSymLink, 0, path);
  }

  /**
   * Creates the directory at `path` and all missing parent directories
   * (mkdir -p semantics), returning the directory at the end of the chain.
   * Store roots are created on demand: the first call for an unknown root
   * span creates the partition's root entry.
   *
   * Existing entries along the walk are reused. A component that is a
   * symlink to a directory is followed and the walk continues inside the
   * target. Created directories receive the store's default timestamps.
   *
   * Returns `{ ok: true, dir }` where `dir` is the created or existing
   * directory at `path`.
   *
   * Returns `{ ok: false, failure }` when no directory can exist at `path`:
   *
   * - `not-a-directory`: a component of the walk is a file, or a symlink
   *   component resolves to a file
   * - `symlink-loop`: more than {@link MAX_SYMLINK_DEPTH} links were
   *   followed
   * - the failure data of resolving a symlink component's target: for
   *   example `missing-entry` for a dangling link
   *
   * @param path - Directory to create.
   */
  ensureDirectory(path: QualifiedPath): EnsureDirectoryResult {
    const rootKey = rootKeyOf(path);
    let root = this.#roots.get(rootKey);
    if (root === undefined) {
      root = {
        type: "dir",
        id: this.nextId(),
        name: path.root,
        times: DEFAULT_TIMES,
        children: new Map(),
      };
      this.#roots.set(rootKey, root);
    }

    return this.#ensureFrom(root, path.components().toArray(), 0, path);
  }

  /**
   * Places an existing node object at `path`.
   *
   * The node is stored by reference, not copied: attaching the same node
   * object at two paths makes them share identity and content, which is how
   * hardlinks are expressed. Missing parent directories are not created;
   * callers that want auto-creation call {@link ensureDirectory} first.
   *
   * Returns `{ ok: true, parent }` when the node was stored, where `parent`
   * is the directory the node was attached to.
   *
   * Returns `{ ok: false, failure }` when nothing was stored:
   *
   * - the failure data of resolving the parent directory: `missing-entry`,
   *   `not-a-directory` or `symlink-loop`
   * - `not-a-directory`: the parent path resolves to a non-directory entry
   * - `target-exists`: the target path is a store root (roots cannot be
   *   attached to), or the target path is already occupied and `overwrite`
   *   is not set
   *
   * With `overwrite` set, an occupied target is replaced wholesale. No link
   * bookkeeping is performed: `attach` is purely structural.
   *
   * @param path - Path to place the node at.
   * @param node - Node to place; stored by reference.
   * @param options - Whether to replace an occupied target.
   */
  attach(path: QualifiedPath, node: Node, options?: { overwrite?: boolean }): AttachResult {
    if (path.path === path.root) {
      return { ok: false, failure: { type: "target-exists", path } };
    }

    const parentLookup = this.lookup(path.parent());
    if (!parentLookup.ok) {
      return { ok: false, failure: parentLookup.failure };
    }

    const parent = parentLookup.node;
    if (parent.type !== "dir") {
      return { ok: false, failure: { type: "not-a-directory", path } };
    }

    const key = path.basename.toLowerCase();
    if (parent.children.has(key) && options?.overwrite !== true) {
      return { ok: false, failure: { type: "target-exists", path } };
    }

    parent.children.set(key, node);
    return { ok: true, parent };
  }

  /**
   * Removes the node stored at `path` from its parent directory and returns
   * it. The node object itself is not destroyed: callers can reattach it
   * elsewhere with {@link attach} (move), or drop the reference to discard a
   * node and its whole subtree in one step.
   *
   * The final symlink component is not followed: detaching a path that holds
   * a symlink removes the link, not its target.
   *
   * Returns `{ ok: true, node }` when the node was detached, where `node` is
   * the removed entry.
   *
   * Returns `{ ok: false, failure }` when nothing was removed:
   *
   * - the failure data of resolving the path: `missing-entry`,
   *   `not-a-directory` or `symlink-loop`
   * - `no-parent`: the path is a store root, which has no parent entry to
   *   detach from
   *
   * @param path - Path to detach.
   */
  detach(path: QualifiedPath): DetachResult {
    const lookup = this.lookup(path, { parseSymLink: true });
    if (!lookup.ok) {
      return { ok: false, failure: lookup.failure };
    }

    if (lookup.key === "") {
      return { ok: false, failure: { type: "no-parent", path } };
    }

    lookup.parent.children.delete(lookup.key);
    return { ok: true, node: lookup.node };
  }

  /**
   * Removes a file, symlink or empty directory at `path` from its parent
   * directory and returns it. Refuses to remove a directory that still
   * contains entries; callers that want to remove a whole subtree drop the
   * node returned by {@link detach} instead.
   *
   * The final symlink component is not followed: removing a path that holds
   * a symlink removes the link, not its target.
   *
   * Returns `{ ok: true, node }` when the entry was removed, where `node` is
   * the removed entry.
   *
   * Returns `{ ok: false, failure }` when nothing was removed:
   *
   * - the failure data of resolving the path: `missing-entry`,
   *   `not-a-directory` or `symlink-loop`
   * - `not-empty`: the entry is a directory that still has children
   * - `no-parent`: the path is a store root, which has no parent entry to
   *   remove
   *
   * @param path - Path to remove.
   */
  removeEntry(path: QualifiedPath): RemoveEntryResult {
    const lookup = this.lookup(path, { parseSymLink: true });
    if (!lookup.ok) {
      return { ok: false, failure: lookup.failure };
    }

    if (lookup.key === "") {
      return { ok: false, failure: { type: "no-parent", path } };
    }

    const node = lookup.node;
    if (node.type === "dir" && node.children.size > 0) {
      return { ok: false, failure: { type: "not-empty", path } };
    }

    lookup.parent.children.delete(lookup.key);
    return { ok: true, node };
  }

  nextId(): bigint {
    return this.#nextId++;
  }

  #ensureFrom(
    start: Node,
    components: string[],
    depth: number,
    failurePath: QualifiedPath,
  ): EnsureDirectoryResult {
    if (depth > MAX_SYMLINK_DEPTH) {
      return { ok: false, failure: { type: "symlink-loop", path: failurePath } };
    }

    let node: Node = start;
    for (const [index, component] of components.entries()) {
      if (node.type !== "dir") {
        return { ok: false, failure: { type: "not-a-directory", path: failurePath } };
      }

      const key = component.toLowerCase();
      const child = node.children.get(key);
      if (child === undefined) {
        const dir: DirNode = {
          type: "dir",
          id: this.nextId(),
          name: component,
          times: DEFAULT_TIMES,
          children: new Map(),
        };
        node.children.set(key, dir);
        node = dir;
        continue;
      }

      if (child.type === "symlink") {
        const resolved = this.lookup(child.target);
        if (!resolved.ok) {
          return { ok: false, failure: resolved.failure };
        }

        return this.#ensureFrom(resolved.node, components.slice(index + 1), depth + 1, failurePath);
      }

      node = child;
    }

    if (node.type !== "dir") {
      return { ok: false, failure: { type: "not-a-directory", path: failurePath } };
    }

    return { ok: true, dir: node };
  }

  #resolve(
    path: QualifiedPath,
    parseSymLink: boolean,
    depth: number,
    failurePath: QualifiedPath,
  ): LookupResult {
    if (depth > MAX_SYMLINK_DEPTH) {
      return { ok: false, failure: { type: "symlink-loop", path: failurePath } };
    }

    const root = this.#roots.get(rootKeyOf(path));
    if (root === undefined) {
      return { ok: false, failure: { type: "missing-entry", path: failurePath } };
    }

    const components = path.components().toArray();
    let parent: DirNode = root;
    let key = "";
    let node: Node = root;

    for (const [index, component] of components.entries()) {
      if (node.type !== "dir") {
        return { ok: false, failure: { type: "not-a-directory", path: failurePath } };
      }

      parent = node;
      key = component.toLowerCase();
      const child = node.children.get(key);
      if (child === undefined) {
        return { ok: false, failure: { type: "missing-entry", path: failurePath } };
      }

      const isLast = index === components.length - 1;
      if (child.type === "symlink" && !(isLast && parseSymLink)) {
        const target = child.target.join(...components.slice(index + 1));
        return this.#resolve(target, parseSymLink, depth + 1, failurePath);
      }

      node = child;
    }

    return { ok: true, node, parent, key };
  }
}

/** Maximum number of symlinks followed while resolving one path. @public */
export const MAX_SYMLINK_DEPTH: number = 32;

/** Timestamp every store-created entry receives by default. @public */
export const DEFAULT_INSTANT: Temporal.Instant =
  Temporal.Instant.fromEpochMilliseconds(997792946000);

/** StatusTime built from {@link DEFAULT_INSTANT}. @public */
export const DEFAULT_TIMES: StatusTime = {
  accessTime: DEFAULT_INSTANT,
  modifiedTime: DEFAULT_INSTANT,
  changeTime: DEFAULT_INSTANT,
  creationTime: DEFAULT_INSTANT,
};

/**
 * Key of the root entry a path belongs to: the lowercased prefix of the path
 * value up to and including the root span, so scheme, data and root all
 * partition the store.
 */
function rootKeyOf(path: QualifiedPath): string {
  const restLength = path.path.length - path.root.length;
  return path.value.slice(0, path.value.length - restLength).toLowerCase();
}
