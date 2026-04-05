import type { LinuxPathProvider } from "./paths.linux";
import type { WindowsPathProvider } from "./paths.windows";

/** @public */
export type PathComponent = string;

/** @public */
export type Extension = string;

/** @public */
export type ResolvedPath = string;

/** @public */
export type PathResolver = {
  readonly scheme: string;
  readonly parent: PathResolver | null;

  resolve(path: QualifiedPath): Promise<ResolvedPath>;
};

/** @public */
export class PathResolverError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "PathResolverError";
  }
}

/** @public */
export type PathProvider<TBase extends string> = PathResolver & {
  fromBase(base: TBase): Promise<QualifiedPath>;
};

/** @public */
export class PathProviderError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "PathProviderError";
  }
}

/** @public */
export const OSPath = {
  home: "home",
  temp: "temp",
} as const;

/** @public */
export type OSPathBase = (typeof OSPath)[keyof typeof OSPath];

/** @public */
export type OSPathProvider = LinuxPathProvider | WindowsPathProvider;

/** @public */
export class QualifiedPath {
  readonly value: string;
  readonly scheme: string;
  readonly data: string;
  readonly path: string;

  private constructor(
    value: string,
    scheme: string,
    data: string,
    path: string,
  ) {
    this.value = value;
    this.scheme = scheme;
    this.data = data;
    this.path = path;
  }

  public static parse(value: string): QualifiedPath {
    const sep = "://";
    const sepIndex = value.indexOf(sep);
    if (sepIndex === -1) {
      throw new Error(`Invalid QualifiedPath: "${value}"`);
    }

    const scheme = value.slice(0, sepIndex);
    const rest = value.slice(sepIndex + sep.length);

    const dataEnd = rest.lastIndexOf("//");
    const data = dataEnd === -1 ? "" : rest.slice(0, dataEnd);

    const path = dataEnd === -1 ? rest : rest.slice(dataEnd + 2);
    return new QualifiedPath(value, scheme, data, path);
  }

  get extension(): Extension {
    const slash = this.path.lastIndexOf("/");
    const filename = this.path.slice(slash + 1);
    const dot = filename.lastIndexOf(".");
    return dot === -1 ? "" : filename.slice(dot + 1);
  }

  get basename(): string {
    const slash = this.path.lastIndexOf("/");
    return slash === -1 ? this.path : this.path.slice(slash + 1);
  }

  get dirname(): string {
    const slash = this.path.lastIndexOf("/");
    return slash === -1 ? "" : this.path.slice(0, slash);
  }

  parent(): QualifiedPath {
    if (this.path === "") return this;

    const slash = this.path.lastIndexOf("/");
    const parentPath = slash === -1 ? "" : this.path.slice(0, slash);

    const pathStart = this.value.length - this.path.length;
    const parentValue = this.value.slice(
      0,
      pathStart + (slash === -1 ? 0 : slash),
    );
    return new QualifiedPath(parentValue, this.scheme, this.data, parentPath);
  }

  join(...components: PathComponent[]): QualifiedPath {
    if (components.length === 0) return this;
    const joinedPath = this.path
      ? `${this.path}/${components.join("/")}`
      : components.join("/");
    const joinedValue = this.path
      ? `${this.value}/${components.join("/")}`
      : `${this.value}${components.join("/")}`;
    return new QualifiedPath(joinedValue, this.scheme, this.data, joinedPath);
  }

  with(change: {
    extension?: string;
    basename?: string;
    dirname?: string;
  }): QualifiedPath {
    if (
      change.extension === undefined &&
      change.basename === undefined &&
      change.dirname === undefined
    )
      return this;

    const dir = change.dirname ?? this.dirname;

    let filename: string;
    if (change.extension !== undefined) {
      const base = change.basename ?? this.basename;
      const baseExt = base.includes(".")
        ? base.slice(base.lastIndexOf(".") + 1)
        : "";
      const stem = baseExt ? base.slice(0, -(baseExt.length + 1)) : base;
      filename = change.extension ? `${stem}.${change.extension}` : stem;
    } else {
      filename = change.basename ?? this.basename;
    }

    const newPath = dir ? `${dir}/${filename}` : filename;
    const newValue = this.data
      ? `${this.scheme}://${this.data}//${newPath}`
      : `${this.scheme}://${newPath}`;

    return new QualifiedPath(newValue, this.scheme, this.data, newPath);
  }

  componentsIter(): Iterator<PathComponent, never, never> {
    const path = this.path;
    let pos = 0;

    const iterator: Iterator<PathComponent, never, never> = {
      next() {
        if (pos >= path.length) {
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

  toJSON(): string {
    return this.value;
  }
}
