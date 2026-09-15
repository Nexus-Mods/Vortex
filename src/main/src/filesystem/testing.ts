/**
 * Shared test helpers for filesystem tests in `src/main`.
 */

import { QualifiedPath } from "@vortex/shared/filesystem";

import { LinuxPathProviderImpl } from "./paths.linux";
import { WindowsPathProviderImpl } from "./paths.windows";

/**
 * Returns the path provider for the current platform using the real
 * production implementations.
 */
export function platformProvider(): LinuxPathProviderImpl | WindowsPathProviderImpl {
  return process.platform === "win32" ? new WindowsPathProviderImpl() : new LinuxPathProviderImpl();
}

/**
 * Wraps a native path as a {@link QualifiedPath} under the universal
 * `native` scheme, exactly like production code does.
 */
export function nativeToQP(nativePath: string): QualifiedPath {
  return QualifiedPath.fromNative(nativePath);
}
