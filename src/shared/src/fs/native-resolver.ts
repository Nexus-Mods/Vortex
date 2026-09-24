import { DIRECTORY_SEPARATOR, getPathRoot, isUnixRootType } from "./native";
import type { PathResolver, QualifiedPath, ResolvedPath } from "./paths";
import { PathResolverError } from "./paths";

/**
 * The resolver for the universal `native` scheme.
 *
 * QualifiedPaths under the `native` scheme are guaranteed to be sanitized
 * and rooted, so decoding is a prefix strip - no re-parse, no sanitization.
 *
 * The returned {@link ResolvedPath} is OS-canonical: Unix-rooted paths pass
 * through unchanged, while Windows-style roots (DOS, UNC, DOS device) are
 * converted back to their backslash form so consumers can hand the result
 * to shells, external tools and anything else that expects a real native
 * path.
 *
 * @example
 * ```ts @import.meta.vitest
 * const resolver = new NativePathResolver();
 * assert(await resolver.resolve(QualifiedPath.fromNative("C:\\Users\\alice")) === "C:\\Users\\alice");
 * assert(await resolver.resolve(QualifiedPath.fromNative("/home/alice")) === "/home/alice");
 * ```
 *
 * @public */
export class NativePathResolver implements PathResolver {
  readonly scheme = "native";

  async resolve(path: QualifiedPath): Promise<ResolvedPath> {
    if (path.scheme !== this.scheme) {
      throw new PathResolverError(`Unsupported scheme '${path.scheme}'`);
    }

    // strip the `native://` prefix: the path part is a sanitized native path
    const native = path.value.slice(this.scheme.length + 3);

    const root = getPathRoot(native);
    if (isUnixRootType(root.type)) return native;

    // Windows-style roots are canonicalized back to backslash form
    return native.replaceAll(DIRECTORY_SEPARATOR, "\\");
  }
}
