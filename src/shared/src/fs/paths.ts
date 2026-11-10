import { QualifiedPath, type ResolvedPath } from "@nexusmods/paths";

import type { ILinuxPathProvider } from "./paths.linux";
import type { IWindowsPathProvider } from "./paths.windows";

/**
 * Plain-object shape of a {@link QualifiedPath} for transfer across
 * boundaries that cannot carry class instances (IPC, structured clone).
 * Rebuild the instance with {@link fromWire}.
 *
 * @public */
export type QualifiedPathWire = {
  scheme: string;
  data: string;
  path: string;
  root: string;
};

/**
 * Converts a {@link QualifiedPath} to its plain-object wire form. Call this
 * where a path crosses an IPC boundary.
 *
 * @public */
export function toWire(path: QualifiedPath): QualifiedPathWire {
  return { scheme: path.scheme, data: path.data, path: path.path, root: path.root };
}

/**
 * Rebuilds a {@link QualifiedPath} from its wire form, validating it.
 *
 * @throws {@link PathError} when the wire value is not a valid path.
 * @public */
export function fromWire(wire: QualifiedPathWire): QualifiedPath {
  return QualifiedPath.of(wire);
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
 * Path providers for platform native paths.
 * @public */
export type IOSPathProvider = ILinuxPathProvider | IWindowsPathProvider;
