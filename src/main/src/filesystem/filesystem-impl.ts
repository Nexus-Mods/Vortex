import type {
  FileSystem as NodeFileSystem,
  FileSystemBackend as NodeFileSystemBackend,
  PathResolverRegistry,
  Pattern,
  QualifiedPath,
  ResolvedPath,
  StatResult,
  Status,
} from "@vortex/fs";
import type { ReadStream, WriteStream } from "node:fs";

import { FileSystemError } from "@vortex/fs";
import { isAbsolute, relative, sep as pathSep } from "node:path";

/**
 * Node-backed implementation of {@link NodeFileSystem}. Composes a
 * {@link NodeFileSystemBackend} with a {@link PathResolverRegistry}:
 * resolves incoming {@link QualifiedPath} args to native paths via the
 * registry, delegates every operation to the backend, and re-tags iterator
 * entries with `QualifiedPath`s rooted at the caller's input.
 *
 * This is the host-side counterpart to the adaptor-side polyfill produced
 * by `createFileSystemClient`. Adaptors see the same {@link NodeFileSystem}
 * surface the host uses directly.
 *
 * @public
 */
export class NodeFileSystemImpl implements NodeFileSystem {
  readonly #backend: NodeFileSystemBackend;
  readonly #resolvers: PathResolverRegistry;

  constructor(backend: NodeFileSystemBackend, resolvers: PathResolverRegistry) {
    this.#backend = backend;
    this.#resolvers = resolvers;
  }

  async copy(
    source: QualifiedPath,
    target: QualifiedPath,
    options?: { overwrite: boolean },
  ): Promise<void> {
    const [s, t] = await Promise.all([
      this.#resolvers.resolve(source),
      this.#resolvers.resolve(target),
    ]);
    await this.#backend.copy(s, t, options);
  }

  async move(
    source: QualifiedPath,
    target: QualifiedPath,
    options?: { overwrite: boolean },
  ): Promise<void> {
    const [s, t] = await Promise.all([
      this.#resolvers.resolve(source),
      this.#resolvers.resolve(target),
    ]);
    await this.#backend.move(s, t, options);
  }

  async readFile(path: QualifiedPath): Promise<Uint8Array> {
    return this.#backend.readFile(await this.#resolvers.resolve(path));
  }

  async writeFile(path: QualifiedPath, contents: Uint8Array): Promise<void> {
    await this.#backend.writeFile(
      await this.#resolvers.resolve(path),
      contents,
    );
  }

  async createDirectory(path: QualifiedPath): Promise<void> {
    await this.#backend.createDirectory(await this.#resolvers.resolve(path));
  }

  async delete(path: QualifiedPath): Promise<void> {
    await this.#backend.delete(await this.#resolvers.resolve(path));
  }

  async deleteRecursive(path: QualifiedPath): Promise<void> {
    await this.#backend.deleteRecursive(await this.#resolvers.resolve(path));
  }

  async stat(
    path: QualifiedPath,
    options?: { parseSymLink: boolean },
  ): Promise<StatResult> {
    return this.#backend.stat(await this.#resolvers.resolve(path), options);
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
  ): Promise<AsyncIterator<QualifiedPath | [QualifiedPath, Status]>>;
  async enumerateDirectory(
    path: QualifiedPath,
    options?: {
      includeStatus?: boolean | "symlink";
      types?: "all" | "files" | "directories";
      recursive?: boolean;
      include?: Pattern;
      exclude?: Pattern;
    },
  ): Promise<AsyncIterator<QualifiedPath | [QualifiedPath, Status]>> {
    const rootResolved = await this.#resolvers.resolve(path);
    const iter = await this.#backend.enumerateDirectory(rootResolved, options);
    const includeStatus = Boolean(options?.includeStatus);
    return wrapIterator(iter, path, rootResolved, includeStatus);
  }

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
  ): Promise<ReadStream | WriteStream>;
  async createStream(
    path: QualifiedPath,
    mode: string,
    options?: { start?: number; end?: number },
  ): Promise<ReadStream | WriteStream> {
    return this.#backend.createStream(
      await this.#resolvers.resolve(path),
      mode,
      options,
    );
  }

  async createLink(
    from: QualifiedPath,
    to: QualifiedPath,
    type: "hardlink" | "symlink",
  ): Promise<void> {
    const [f, t] = await Promise.all([
      this.#resolvers.resolve(from),
      this.#resolvers.resolve(to),
    ]);
    await this.#backend.createLink(f, t, type);
  }
}

function wrapIterator(
  inner: AsyncIterator<ResolvedPath | readonly [ResolvedPath, Status]>,
  rootQP: QualifiedPath,
  rootResolved: ResolvedPath,
  includeStatus: boolean,
): AsyncIterator<QualifiedPath | [QualifiedPath, Status]> {
  return {
    async next() {
      const step = await inner.next();
      if (step.done === true) return { done: true, value: undefined };
      if (includeStatus) {
        const [native, status] = step.value as readonly [ResolvedPath, Status];
        return {
          done: false,
          value: [toQualifiedEntry(rootQP, rootResolved, native), status],
        };
      }
      return {
        done: false,
        value: toQualifiedEntry(
          rootQP,
          rootResolved,
          step.value as ResolvedPath,
        ),
      };
    },
    async return() {
      await inner.return?.(undefined).catch(() => undefined);
      return { done: true, value: undefined };
    },
    async throw(err) {
      await inner.return?.(undefined).catch(() => undefined);
      throw err;
    },
  };
}

/**
 * Reattaches a native entry path to the caller's root `QualifiedPath`.
 *
 * Uses `path.relative` rather than `String.startsWith` so that the prefix
 * check is separator-aware (handles Windows case-insensitivity and does not
 * match `/tmp/a` against `/tmp/abc/...`).
 *
 * Throws a {@link FileSystemError} with code `generic` if the entry is not
 * under the root (e.g. a symlink followed out of the tree). Node's
 * `opendir({ recursive: true })` does not follow symlinks, so this is a
 * defensive check rather than an expected case.
 */
function toQualifiedEntry(
  rootQP: QualifiedPath,
  rootResolved: ResolvedPath,
  entry: ResolvedPath,
): QualifiedPath {
  const rel = relative(rootResolved, entry);
  if (rel === "") return rootQP;
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new FileSystemError(
      "generic",
      `Directory entry '${entry}' is not under root '${rootResolved}'`,
    );
  }
  const components = rel.split(pathSep).filter((c) => c.length > 0);
  if (components.length === 0) return rootQP;
  return rootQP.join(...components);
}
