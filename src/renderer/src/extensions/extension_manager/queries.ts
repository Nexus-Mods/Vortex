import * as path from "node:path";

import * as semver from "semver";

import type { IAvailableExtension, IRegisteredExtension } from "@/types/extensions";
import type { IExtensionOptional, IExtensionState } from "@/types/IState";

type CatalogQuery = { modId: number; fileId?: number };
type InstalledQuery = { modId: number; fileId?: number } | { path: string };

/** Find an extension in the available catalog. */
export function findInCatalog(
  catalog: IAvailableExtension[],
  query: CatalogQuery,
): IAvailableExtension | undefined {
  return catalog.find((catalogEntry) => matchesQuery(query, catalogEntry));
}

/** Find an installed extension. */
export function findInstalled(
  installedExtensions: Record<string, IExtensionState>,
  query: InstalledQuery,
): { key: string; extension: IExtensionState } | undefined {
  const queryPath = "path" in query ? path.normalize(query.path).toLowerCase() : undefined;

  const result = Object.entries(installedExtensions).find(([_, extension]) => {
    if (queryPath !== undefined)
      return (
        extension.path !== undefined && path.normalize(extension.path).toLowerCase() === queryPath
      );
    return matchesQuery(query as CatalogQuery, extension);
  });

  if (result === undefined) return undefined;

  const [key, extension] = result;
  return { key, extension };
}

/** Checks whether the given entry matches the query. */
export function matchesQuery(
  query: { modId: number; fileId?: number },
  entry: IExtensionState | IAvailableExtension,
): boolean {
  if (entry.modId !== query.modId) return false;
  return query.fileId !== undefined ? entry.fileId === query.fileId : true;
}

/**
 * Build the entry for a scanned extension. `recorded` is an entry for the same
 * extension that this one replaces - the path-less shape releases up to v2.4.x
 * persist - and what it records wins over the extension's own values.
 */
export function extensionStateFromScan(
  ext: IRegisteredExtension,
  recorded?: IExtensionState,
): IExtensionState {
  return {
    name: ext.name,
    author: ext.info?.author ?? "<unknown>",
    description: ext.info?.description ?? "<missing>",
    version: recorded?.version ?? ext.info?.version ?? "0.0.1",
    infoJsonId: ext.info?.id,
    path: ext.path,
    bundled: ext.info?.bundled,
    enabled: recorded?.enabled ?? true,
    endorsed: recorded?.endorsed ?? "Undecided",
    remove: recorded?.remove ?? false,
  };
}

/** Find a dependency extension by its declared identifier among the installed extensions. */
export function findInstalledDependency(
  installedExtensions: Record<string, IExtensionState>,
  dependencyId: string,
): { key: string; extension: IExtensionState } | undefined {
  const result = Object.entries(installedExtensions).find(
    ([_, entry]) => entry.infoJsonId === dependencyId || entry.name === dependencyId,
  );
  if (result === undefined) return undefined;

  const [key, extension] = result;
  return { key, extension };
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
  return (
    findInstalled(installedExtensions, {
      modId: catalogEntry.modId,
      fileId: catalogEntry.fileId,
    }) !== undefined
  );
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

/** Get missing optional dependencies of an extension. */
export function getMissingOptionalExtensions(
  optionalExtensions: IExtensionOptional[],
  loadedExtensions: IRegisteredExtension[],
): IExtensionOptional[] {
  return optionalExtensions.filter(
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
    const available = findInCatalog(catalog, { modId: installed.modId });
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
