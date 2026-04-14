/**
 * Shared test helpers for filesystem tests. Provides a platform-aware
 * path resolver so tests produce valid QualifiedPaths on both Linux
 * and Windows.
 */

import type { PathResolver, ResolvedPath } from "../browser/paths";

import { PathResolverError, QualifiedPath } from "../browser/paths";

/**
 * Returns the QualifiedPath scheme for the current platform.
 * Linux/macOS → `"linux"`, Windows → `"windows"`.
 */
export function platformScheme(): string {
  return process.platform === "win32" ? "windows" : "linux";
}

/**
 * Wraps a native temp-directory path as a {@link QualifiedPath} using the
 * platform-appropriate scheme.
 *
 * - Linux:   `linux:///tmp/test-abc`
 * - Windows: `windows:///C/Users/alice/AppData/Local/Temp/test-abc`
 */
export function nativeToQP(nativePath: string): QualifiedPath {
  const scheme = platformScheme();
  if (scheme === "windows") {
    const forward = nativePath.replace(/\\/g, "/");
    const match = /^([A-Za-z]):\/(.*)$/.exec(forward);
    if (match) {
      const drive = match[1].toUpperCase();
      const tail = match[2];
      const path = tail.length > 0 ? `/${drive}/${tail}` : `/${drive}`;
      return QualifiedPath.parse(`${scheme}://${path}`);
    }
  }
  return QualifiedPath.parse(`${scheme}://${nativePath}`);
}

/**
 * Creates a {@link PathResolver} for the current platform that resolves
 * QualifiedPaths back to native paths. Suitable for test fixtures.
 */
export function platformResolver(): PathResolver {
  const scheme = platformScheme();
  return {
    scheme,
    parent: null,
    resolve(path: QualifiedPath): Promise<ResolvedPath> {
      if (path.scheme !== scheme) {
        return Promise.reject(
          new PathResolverError(`Unsupported scheme '${path.scheme}'`),
        );
      }
      if (scheme === "windows") {
        // windows:///C/Users/alice → C:\Users\alice
        const p = path.path;
        if (!p.startsWith("/")) {
          return Promise.reject(
            new PathResolverError(`Invalid windows path: must be rooted`),
          );
        }
        const rest = p.slice(1);
        const slash = rest.indexOf("/");
        const drive = slash === -1 ? rest : rest.slice(0, slash);
        const tail = slash === -1 ? "" : rest.slice(slash + 1);
        const native =
          tail.length > 0
            ? `${drive.toUpperCase()}:\\${tail.replace(/\//g, "\\")}`
            : `${drive.toUpperCase()}:\\`;
        return Promise.resolve(native);
      }
      // Linux: the path component is already a native path
      return Promise.resolve(path.path);
    },
  };
}
