import type {
  PathResolver,
  PathResolverRegistry,
  QualifiedPath,
  ResolvedPath,
} from "@nexusmods/adaptor-api/fs";
import { PathResolverError } from "@nexusmods/adaptor-api/fs";

/**
 * Default {@link PathResolverRegistry} implementation backed by a `Map`.
 *
 * @public */
export class PathResolverRegistryImpl implements PathResolverRegistry {
  readonly #byScheme = new Map<string, PathResolver>();

  constructor(resolvers?: Iterable<PathResolver>) {
    if (resolvers) {
      for (const resolver of resolvers) this.register(resolver);
    }
  }

  register(resolver: PathResolver): void {
    this.#byScheme.set(resolver.scheme, resolver);
  }

  get(scheme: string): PathResolver | undefined {
    return this.#byScheme.get(scheme);
  }

  resolve(path: QualifiedPath): Promise<ResolvedPath> {
    const resolver = this.#byScheme.get(path.scheme);
    if (!resolver) {
      return Promise.reject(
        new PathResolverError(`No resolver registered for scheme '${path.scheme}'`),
      );
    }
    return resolver.resolve(path);
  }
}
