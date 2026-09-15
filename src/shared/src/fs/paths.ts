import { VortexError } from "../errors/base";
import { parseNativePath } from "./native";
import type { LinuxPathProvider } from "./paths.linux";
import type { WindowsPathProvider } from "./paths.windows";

/** @public */
export type PathComponent = string;

/**
 * Extension of a path without the period.
 *
 * @example `txt`
 * @public */
export type Extension = string;

/**
 * Opaque platform native path.
 *
 * @public */
export type ResolvedPath = string;

/**
 * Plain-object shape of a {@link QualifiedPath} for transfer across
 * boundaries that cannot carry class instances (IPC, structured clone).
 * Rebuild the instance with {@link QualifiedPath.of}.
 *
 * @public */
export type QualifiedPathWire = {
  scheme: string;
  data: string;
  path: string;
  root: string;
};

declare const RelativePathBrand: unique symbol;

/**
 * Forward-slash-separated relative path. Guaranteed to have no leading
 * slash, no drive-letter prefix, and no `..` segments. Values are only
 * constructed through {@link relativePath}, which validates and
 * normalizes the input.
 *
 * @public */
export type RelativePath = string & { readonly [RelativePathBrand]: true };

/**
 * Constructs a {@link RelativePath} after validation and normalization.
 *
 * - Backslashes are converted to forward slashes.
 * - A single trailing slash is trimmed.
 * - Empty segments (repeated separators) are collapsed.
 *
 * @throws {@link RelativePathError} if the input is absolute (leading
 * slash), contains a Windows drive-letter prefix (e.g. `C:`), or
 * contains any `..` segment.
 *
 * @example
 * ```ts @import.meta.vitest
 * assert(relativePath("foo/bar.txt") === "foo/bar.txt");
 * assert(relativePath("foo\\bar\\baz") === "foo/bar/baz");
 * assert(relativePath("foo/") === "foo");
 * ```
 *
 * @public */
export function relativePath(raw: string): RelativePath {
  const normalized = raw.replace(/\\/g, "/");

  if (normalized.startsWith("/")) {
    throw new VortexError(`RelativePath must not start with '/': "${raw}"`, {
      kind: "fs:invalid-path",
      path: raw,
    });
  }
  if (/^[A-Za-z]:/.test(normalized)) {
    throw new VortexError(`RelativePath must not include a drive letter: "${raw}"`, {
      kind: "fs:invalid-path",
      path: raw,
    });
  }

  const trimmed =
    normalized.endsWith("/") && normalized.length > 1 ? normalized.slice(0, -1) : normalized;

  const segments = trimmed.split("/").filter((s) => s.length > 0);
  if (segments.some((s) => s === "..")) {
    throw new VortexError(`RelativePath must not contain '..' segments: "${raw}"`, {
      kind: "fs:invalid-path",
      path: raw,
    });
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return segments.join("/") as RelativePath;
}

/**
 * Resolves {@link QualifiedPath} to {@link ResolvedPath}.
 *
 * @public */
export type PathResolver = {
  /** Unique scheme to map {@link QualifiedPath} to this instance. Without the `://` at the end. */
  readonly scheme: string;

  /** Resolves {@link QualifiedPath} to {@link ResolvedPath}.
   * @throws PathResolverError on failure.
   * */
  resolve(path: QualifiedPath): Promise<ResolvedPath>;
};

/**
 * Thrown by {@link PathResolver} instances when failing to resolve a {@link QualifiedPath}.
 * @public */
export class PathResolverError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "PathResolverError";
  }
}

/**
 * Dispatches path resolution across multiple {@link PathResolver}s keyed by
 * scheme. Resolvers are registered by their {@link PathResolver.scheme} and
 * selected by matching the scheme of the {@link QualifiedPath} being
 * resolved.
 *
 * @public */
export interface PathResolverRegistry {
  /** Registers a resolver for its declared scheme. Overwrites any prior
   *  resolver for the same scheme. */
  register(resolver: PathResolver): void;

  /** Returns the resolver for the given scheme, or `undefined` if none is
   *  registered. */
  get(scheme: string): PathResolver | undefined;

  /** Resolves the given {@link QualifiedPath} by dispatching to the resolver
   *  registered for its scheme.
   *
   * @throws {@link PathResolverError} when no resolver is registered for the
   *   path's scheme. */
  resolve(path: QualifiedPath): Promise<ResolvedPath>;
}

/**
 * Creates {@link QualifiedPath} instances from well-known bases. Providers
 * are factories for the paths of the scheme they serve; resolving those
 * paths back to native ones is a {@link PathResolver}'s job.
 *
 * @public */
export type PathProvider<TBase extends string> = {
  /**
   * Creates a {@link QualifiedPath} from a well-known base.
   * @throws PathProviderError on invalid inputs.
   * */
  fromBase(base: TBase): Promise<QualifiedPath>;
};

/**
 * Thrown by {@link PathProvider} instances when failing to create a {@link QualifiedPath}.
 * @public */
export class PathProviderError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "PathProviderError";
  }
}

/**
 * Bases supported by all OS path providers.
 * @public */
export const OSPath = {
  home: "home",
  temp: "temp",
} as const;

/**
 * Bases supported by all OS path providers.
 * @public */
export type OSPathBase = (typeof OSPath)[keyof typeof OSPath];

/**
 * Path providers for platform native paths.
 * @public */
export type OSPathProvider = LinuxPathProvider | WindowsPathProvider;

/**
 * Represents a normalized fully qualified path.
 *
 * A QualifiedPath is fully described by its parts ({@link scheme},
 * {@link data}, {@link path}, {@link root}); {@link value} is derived from
 * them. Paths only ever enter the system through {@link QualifiedPath.of}
 * (already structured) or {@link QualifiedPath.fromNative} (raw native
 * paths).
 *
 * @public */
export class QualifiedPath {
  /** Raw string of the entire path, derived from the parts.
   *
   * @example
   *
   * ```ts @import.meta.vitest
   * const path = QualifiedPath.of({ scheme: "foo", data: "bar//baz", path: "file.txt", root: "" });
   * assert(path.value === "foo://bar//baz//file.txt");
   * ```
   * */
  readonly value: string;

  /** Scheme part without the `://`
   *
   * @example
   *
   * ```ts @import.meta.vitest
   * const path = QualifiedPath.of({ scheme: "foo", data: "bar//baz", path: "file.txt", root: "" });
   * assert(path.scheme === "foo");
   * ```
   * */
  readonly scheme: string;

  /** Data part.
   *
   * @example
   *
   * ```ts @import.meta.vitest
   * const path = QualifiedPath.of({ scheme: "foo", data: "bar//baz", path: "file.txt", root: "" });
   * assert(path.data === "bar//baz");
   * ```
   * */
  readonly data: string;

  /** Path part.
   *
   * @example
   *
   * ```ts @import.meta.vitest
   * const path = QualifiedPath.of({ scheme: "foo", data: "bar//baz", path: "user/file.txt", root: "" });
   * assert(path.path === "user/file.txt");
   * ```
   * */
  readonly path: string;

  /**
   * The root span of {@link path}, or an empty string when the path has no
   * root. For `native` paths this is the sanitized root (`C:/`, `/`,
   * `//server/share/`, `//?/C:/`, ...). Rooted paths keep their trailing
   * directory separator, so the root always ends with one.
   *
   * @example
   * ```ts @import.meta.vitest
   * const path = QualifiedPath.fromNative("C:\\Users\\alice");
   * assert(path.root === "C:/");
   * ```
   * */
  readonly root: string;

  private constructor(scheme: string, data: string, path: string, root: string) {
    this.scheme = scheme;
    this.data = data;
    this.path = path;
    this.root = root;
    this.value = data !== "" ? `${scheme}://${data}//${path}` : `${scheme}://${path}`;
  }

  /**
   * Generic constructor from explicit parts. The single entry point for
   * already-structured paths: wire data crossing an IPC boundary and
   * schemes with their own semantics.
   *
   * @throws {@link VortexError} when the scheme is empty or {@link root}
   *   is not a canonical prefix of {@link path} (a root must either be
   *   empty, end at a separator, or be the whole path).
   *
   * @example
   * ```ts @import.meta.vitest
   * const path = QualifiedPath.of({ scheme: "native", data: "", path: "C:/Users", root: "C:/" });
   * assert(path.value === "native://C:/Users");
   * ```
   *
   * @public
   */
  public static of(fields: QualifiedPathWire): QualifiedPath {
    if (fields.scheme.length === 0) {
      throw new VortexError("QualifiedPath scheme must not be empty", {
        kind: "fs:invalid-path",
        path: fields.path,
      });
    }
    const rootValid =
      fields.root === "" ||
      (fields.path.startsWith(fields.root) &&
        (fields.root === fields.path || fields.root.endsWith("/")));
    if (!rootValid) {
      throw new VortexError(
        `Root "${fields.root}" is not a canonical prefix of the path "${fields.path}"`,
        { kind: "fs:invalid-path", path: fields.path },
      );
    }
    return new QualifiedPath(fields.scheme, fields.data, fields.path, fields.root);
  }

  /**
   * The entry point for raw, native paths: sanitizes the input and wraps it
   * as a {@link QualifiedPath} under the `native` scheme.
   *
   * This is the only supported way to bring a path from outside the path
   * system (the OS, environment variables, user input) into it. The
   * sanitization happens here, once, and the result is trusted everywhere
   * else.
   *
   * @throws {@link VortexError} when the input is not a rooted path
   *   (no Unix, DOS, UNC or DOS-device root).
   *
   * @example
   * ```ts @import.meta.vitest
   * const dos = QualifiedPath.fromNative("C:\\Users\\alice\\file.txt");
   * assert(dos.value === "native://C:/Users/alice/file.txt");
   *
   * const unix = QualifiedPath.fromNative("/home/alice");
   * assert(unix.value === "native:///home/alice");
   *
   * const unc = QualifiedPath.fromNative("\\\\server\\share\\file.txt");
   * assert(unc.value === "native:////server/share/file.txt");
   * ```
   *
   * @public
   */
  public static fromNative(raw: string): QualifiedPath {
    const { normalizedPath, root } = parseNativePath(raw);
    if (root.type === "None") {
      throw new VortexError(`Path is not rooted (no Unix, DOS, UNC or DOS-device root): "${raw}"`, {
        kind: "fs:invalid-path",
        path: raw,
      });
    }
    return new QualifiedPath("native", "", normalizedPath, root.span);
  }

  /**
   * Compares two {@link QualifiedPath}s case-insensitively.
   *
   * Case-sensitivity of real paths depends on the filesystem and its mount
   * options, which this application neither knows nor cares about, so all
   * comparisons are case-insensitive. Sanitization already guarantees
   * canonical separators and trailing slashes, so case-folding the raw
   * values is the entire normalization.
   *
   * @returns a negative number if `a` sorts before `b`, a positive number
   *   if `a` sorts after `b`, and `0` if they are equal.
   *
   * @example
   * ```ts @import.meta.vitest
   * const a = QualifiedPath.fromNative("C:/Users");
   * const b = QualifiedPath.fromNative("c:/users");
   * assert(QualifiedPath.compare(a, b) === 0);
   * assert(QualifiedPath.compare(QualifiedPath.fromNative("C:/tmp"), a) < 0);
   * ```
   *
   * @public
   */
  public static compare(a: QualifiedPath, b: QualifiedPath): number {
    const left = a.value.toLowerCase();
    const right = b.value.toLowerCase();
    return left < right ? -1 : left > right ? 1 : 0;
  }

  /**
   * Returns whether two {@link QualifiedPath}s are equal, case-insensitively.
   * See {@link QualifiedPath.compare} for the rationale.
   *
   * @example
   * ```ts @import.meta.vitest
   * const a = QualifiedPath.fromNative("C:/Users");
   * const b = QualifiedPath.fromNative("c:/users");
   * assert(QualifiedPath.equals(a, b));
   * ```
   *
   * @public
   */
  public static equals(a: QualifiedPath, b: QualifiedPath): boolean {
    return QualifiedPath.compare(a, b) === 0;
  }

  /**
   * Returns the slice after the last period.
   *
   * @example
   *
   * ```ts @import.meta.vitest
   * const path = QualifiedPath.of({ scheme: "foo", data: "", path: "bar.baz.txt", root: "" });
   * assert(path.extension === "txt");
   * ```
   * */
  get extension(): Extension {
    const slash = this.path.lastIndexOf("/");
    const filename = this.path.slice(slash + 1);
    const dot = filename.lastIndexOf(".");
    return dot === -1 ? "" : filename.slice(dot + 1);
  }

  /**
   * Returns the slice of the last path component.
   *
   * @example
   *
   * ```ts @import.meta.vitest
   * const path = QualifiedPath.of({ scheme: "foo", data: "bar", path: "baz.txt", root: "" });
   * assert(path.basename === "baz.txt");
   * ```
   * */
  get basename(): string {
    const slash = this.path.lastIndexOf("/");
    return slash === -1 ? this.path : this.path.slice(slash + 1);
  }

  /**
   * Returns the directory containing the last path component. Paths at or
   * above their root have no containing directory and return an empty
   * string.
   *
   * @example
   *
   * ```ts @import.meta.vitest
   * const path = QualifiedPath.of({ scheme: "foo", data: "bar", path: "a/b/c.txt", root: "" });
   * assert(path.dirname === "a/b");
   * ```
   * */
  get dirname(): string {
    if (this.path === "" || this.path === this.root) return "";
    const slash = this.path.lastIndexOf("/");
    return slash < this.root.length ? this.root : this.path.slice(0, slash);
  }

  /**
   * Creates a new path without the last component. Returns the same
   * instance if there is no path. The parent of a root is the root itself.
   *
   * @example
   *
   * ```ts @import.meta.vitest
   * const path = QualifiedPath.of({ scheme: "foo", data: "bar", path: "a/b/c.txt", root: "" });
   * assert(path.parent().value === "foo://bar//a/b");
   *
   * const topPath = QualifiedPath.of({ scheme: "foo", data: "", path: "", root: "" });
   * assert(topPath.parent().value === topPath.value);
   * ```
   * */
  parent(): QualifiedPath {
    if (this.path === "") return this;

    if (this.root === "") {
      // no root semantics: drop the last path component
      const slash = this.path.lastIndexOf("/");
      const parentPath = slash === -1 ? "" : this.path.slice(0, slash);
      return new QualifiedPath(this.scheme, this.data, parentPath, "");
    }

    // the parent of a root is the root itself
    if (this.path === this.root) return this;

    const slash = this.path.lastIndexOf("/");
    // the last separator is part of the root: the parent is the root
    const parentPath = slash < this.root.length ? this.root : this.path.slice(0, slash);
    return new QualifiedPath(this.scheme, this.data, parentPath, this.root);
  }

  join(...components: PathComponent[]): QualifiedPath {
    if (components.length === 0) return this;
    const tail = components.join("/");
    // rooted paths end with a separator, so only join when needed
    const joinedPath =
      this.path === "" || this.path.endsWith("/") ? `${this.path}${tail}` : `${this.path}/${tail}`;
    return new QualifiedPath(this.scheme, this.data, joinedPath, this.root);
  }

  with(change: { extension?: string; basename?: string; dirname?: string }): QualifiedPath {
    if (
      change.extension === undefined &&
      change.basename === undefined &&
      change.dirname === undefined
    )
      return this;

    const rawDir = change.dirname ?? this.dirname;
    // Rooted paths: a dirname must include the root, so a bare dirname is
    // treated as root-relative.
    const dir =
      this.root !== "" && !rawDir.startsWith(this.root)
        ? rawDir === ""
          ? this.root
          : `${this.root}${this.root.endsWith("/") ? "" : "/"}${rawDir}`
        : rawDir;

    let filename: string;
    if (change.extension !== undefined) {
      const base = change.basename ?? this.basename;
      const baseExt = base.includes(".") ? base.slice(base.lastIndexOf(".") + 1) : "";
      const stem = baseExt ? base.slice(0, -(baseExt.length + 1)) : base;
      filename = change.extension ? `${stem}.${change.extension}` : stem;
    } else {
      filename = change.basename ?? this.basename;
    }

    const newPath =
      dir === "" ? filename : dir.endsWith("/") ? `${dir}${filename}` : `${dir}/${filename}`;
    return new QualifiedPath(this.scheme, this.data, newPath, this.root);
  }

  componentsIter(): Iterator<PathComponent, never, never> {
    const path = this.path;
    // native paths start with their root span, which is not a component
    let pos = this.root.length;

    const iterator: Iterator<PathComponent, never, never> = {
      next() {
        if (pos >= path.length) {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          return { done: true, value: undefined as never };
        }
        const end = path.indexOf("/", pos);
        if (end === -1) {
          const value = path.slice(pos);
          pos = path.length;
          return { done: false, value };
        }
        const value = path.slice(pos, end);
        pos = end + 1;
        return { done: false, value };
      },
    };

    return iterator;
  }

  components(): IteratorObject<PathComponent> {
    return Iterator.from(this.componentsIter());
  }

  /**
   * Returns the plain-object shape of this path for transport across
   * boundaries that cannot carry class instances (IPC, structured clone).
   * Reconstruct with {@link QualifiedPath.of}.
   */
  toWire(): QualifiedPathWire {
    return { scheme: this.scheme, data: this.data, path: this.path, root: this.root };
  }

  toJSON(): string {
    return this.value;
  }
}
