import type {
  IAvailableExtension,
  IExtension,
} from "../extensions/extension_manager/types";

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
