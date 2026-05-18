/**
 * Shared test helpers for filesystem tests in `src/main`. Provides a
 * platform-aware path resolver so tests produce valid QualifiedPaths on
 * both Linux and Windows.
 */

import type { PathResolver } from "@nexusmods/adaptor-api/fs";
import { QualifiedPath } from "@nexusmods/adaptor-api/fs";

import { LinuxPathProviderImpl } from "./paths.linux";
import { WindowsPathProviderImpl } from "./paths.windows";

/**
 * Returns a {@link PathResolver} for the current platform using the real
 * production implementations.
 */
export function platformResolver(): PathResolver {
  return process.platform === "win32" ? new WindowsPathProviderImpl() : new LinuxPathProviderImpl();
}

/**
 * Returns the QualifiedPath scheme for the current platform.
 */
export function platformScheme(): string {
  return process.platform === "win32" ? "windows" : "linux";
}

/**
 * Wraps a native temp-directory path as a {@link QualifiedPath} using the
 * platform-appropriate scheme and encoding.
 *
 * NOTE: The Windows encoding here must match WindowsPathProviderImpl.#create
 * (src/main/src/filesystem/paths.windows.ts) and nativeToQualifiedPath
 * (src/main/src/adaptors.ts).
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
