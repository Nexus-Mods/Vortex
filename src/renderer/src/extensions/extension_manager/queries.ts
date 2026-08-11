import * as semver from "semver";

import type { IAvailableExtension, IRegisteredExtension } from "@/types/extensions";
import type { IExtensionOptional, IExtensionState } from "@/types/IState";

/** Find an extension in the available catalog that matches this installed extension. */
export function findInCatalog(
  catalog: IAvailableExtension[],
  extension: IExtensionState,
): IAvailableExtension | undefined {
  return catalog.find((catalogEntry) => isSameExtension(extension, catalogEntry));
}

/** Find a dependency extension by its declared identifier in the catalog. */
export function findDependencyInCatalog(
  catalog: IAvailableExtension[],
  dependencyId: string,
): IAvailableExtension | undefined {
  return catalog.find(
    (catalogEntry) => catalogEntry.id === dependencyId || catalogEntry.name === dependencyId,
  );
}

/** Checks whether an extension from the catalog is already installed. */
export function isAlreadyInstalled(
  installedExtensions: Record<string, IExtensionState>,
  catalogEntry: IAvailableExtension,
): boolean {
  return Object.values(installedExtensions).some((extension) =>
    isSameExtension(extension, catalogEntry, true),
  );
}

/** Find a dependency extension by its declared identifier among the already installed extensions. */
export function findInstalledDependency(
  installedExtensions: Record<string, IExtensionState>,
  dependencyId: string,
): { key: string; extension: IExtensionState } | undefined {
  const result = Object.entries(installedExtensions).find(
    ([_, extension]) => extension.infoJsonId === dependencyId || extension.name === dependencyId,
  );

  if (result === undefined) return undefined;
  const [key, extension] = result;
  return { key, extension };
}

/** Determine if an installed extension and a catalog entry represent the same extension. */
export function isSameExtension(
  installed: IExtensionState,
  catalogEntry: IAvailableExtension,
  matchVersion?: boolean,
): boolean {
  if (installed.modId !== catalogEntry.modId) return false;
  return matchVersion ? installed.fileId === catalogEntry.fileId : true;
}

/** Find all currently installed versions of an extension. */
export function findPreviousVersions(
  installedExtension: Record<string, IExtensionState>,
  catalogEntry: IAvailableExtension,
): Array<{ key: string; extension: IExtensionState }> {
  return Object.entries(installedExtension)
    .filter(([_, extension]) => extension.modId === catalogEntry.modId)
    .map(([key, extension]) => ({ key, extension }));
}

/** Get optional dependencies of an extension. */
export function getOptionalExtensions(
  optionalExtensions: Record<string, IExtensionOptional[]>,
  gameExtension: IExtensionState,
): IExtensionOptional[] {
  // NOTE(erri120): ExtensionManager creates a map with the extension name as the key...
  // TODO: use a generated session-based key instead of the extension name
  return optionalExtensions[gameExtension.name] ?? [];
}

/** Get missing optional dependencies of an extension. */
export function getMissingOptionalExtensions(
  optionalExtensions: Record<string, IExtensionOptional[]>,
  gameExtension: IExtensionState,
  loadedExtensions: IRegisteredExtension[],
): IExtensionOptional[] {
  const optionals = getOptionalExtensions(optionalExtensions, gameExtension);
  return optionals.filter(
    (optional) =>
      !loadedExtensions.some(
        (loadedExtension) =>
          loadedExtension.info?.id === optional.id || loadedExtension.name === optional.id,
      ),
  );
}

/** Find all installed extensions that have updates available. */
export function findUpdatableExtensions(
  installedExtensions: Record<string, IExtensionState>,
  catalog: IAvailableExtension[],
): Array<{ key: string; installed: IExtensionState; available: IAvailableExtension }> {
  const result: Array<{ key: string; installed: IExtensionState; available: IAvailableExtension }> =
    [];

  for (const [key, installed] of Object.entries(installedExtensions)) {
    const available = findInCatalog(catalog, installed);
    if (available === undefined) continue;

    const installedVersion = semver.coerce(installed.version);
    const availableVersion = semver.coerce(available.version);

    if (installedVersion === null || availableVersion === null) {
      continue;
    }

    if (semver.lt(installedVersion, availableVersion)) {
      result.push({ key, installed, available });
    }
  }

  return result;
}
