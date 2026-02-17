import type { IAvailableExtension, IExtension } from "../types/extensions";

/**
 * Check if an installed extension matches a remote available extension
 */
export function isExtSame(
  installed: IExtension,
  remote: IAvailableExtension,
): boolean {
  if (installed.modId !== undefined) {
    return installed.modId === remote.modId;
  }

  return installed.name === remote.name;
}
