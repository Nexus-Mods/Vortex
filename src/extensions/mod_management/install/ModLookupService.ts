/**
 * ModLookupService - Provides mod and download lookup utilities.
 * Extracted from InstallManager.ts for better modularity and testability.
 *
 * This module provides stateless utility functions for:
 * - Finding previous versions of mods
 * - Checking for existing mod variants
 * - Finding downloads matching mod references
 * - Checking mod references for fuzzy matching
 */

import * as path from "path";
import type * as Redux from "redux";

import { truthy } from "../../../util/util";

import { findDownloadByRef } from "../util/dependencies";
import { testRefByIdentifiers } from "../util/testModReference";
import type { IMod, IModReference } from "../types/IMod";
import type { IDownload } from "../../download_management/types/IDownload";
import type { IExtensionApi } from "../../../types/IExtensionContext";

/**
 * Check if a mod reference contains fuzzy matching criteria.
 *
 * Fuzzy references use file expressions, MD5 hashes, or logical filenames
 * to match mods, rather than exact IDs.
 *
 * @param ref - Mod reference to check
 * @returns True if the reference uses fuzzy matching
 */
export function hasFuzzyReference(ref: IModReference): boolean {
  return (
    ref.fileExpression !== undefined ||
    ref.fileMD5 !== undefined ||
    ref.logicalFileName !== undefined
  );
}

/**
 * Find all mod IDs that match a given archive ID (variants of the same mod).
 *
 * @param api - Extension API for state access
 * @param gameMode - Game ID to search in
 * @param archiveId - Archive ID to match
 * @returns Array of mod IDs that share the archive ID
 */
export function checkModVariantsExist(
  api: IExtensionApi,
  gameMode: string,
  archiveId: string,
): string[] {
  if (archiveId === null) {
    return [];
  }
  const state = api.getState();
  const mods = Object.values(state.persistent.mods[gameMode] || []) as IMod[];
  return mods.filter((mod) => mod.archiveId === archiveId).map((mod) => mod.id);
}

/**
 * Check if a mod with the given install name already exists.
 *
 * @param installName - Installation name to check
 * @param api - Extension API for state access
 * @param gameMode - Game ID to search in
 * @returns Array of matching mod IDs (will have at most 1 element)
 */
export function checkModNameExists(
  installName: string,
  api: IExtensionApi,
  gameMode: string,
): string[] {
  const state = api.getState();
  const mods = Object.values(state.persistent.mods[gameMode] || []) as IMod[];
  // Yes I know that only 1 mod id can ever match the install name, but it's more consistent
  //  with the variant check as we don't have to check for undefined too.
  return mods.filter((mod) => mod.id === installName).map((mod) => mod.id);
}

/**
 * Find a previous version of a mod by its newest file ID.
 *
 * This is used to detect when a user is installing an update to an existing mod.
 * It compares the incoming fileId against the newestFileId attribute of installed mods.
 *
 * @param fileId - The file ID to search for
 * @param store - Redux store for state access
 * @param gameMode - Game ID to search in
 * @param isCollection - Whether to search for collections vs regular mods
 * @returns The matching mod, or undefined if not found
 */
export function findPreviousVersionMod(
  fileId: number,
  store: Redux.Store<any>,
  gameMode: string,
  isCollection: boolean,
): IMod | undefined {
  const mods = store.getState().persistent.mods[gameMode] || {};
  // This is not great, but we need to differentiate between revisionIds and fileIds
  //  as it's perfectly possible for a collection's revision id to match a regular
  //  mod's fileId resulting in false positives and therefore mashed up metadata.
  const filterFunc = (modId: string) =>
    isCollection
      ? mods[modId].type === "collection"
      : mods[modId].type !== "collection";
  let mod: IMod | undefined;
  Object.keys(mods)
    .filter(filterFunc)
    .forEach((key) => {
      // TODO: fileId/revisionId can potentially be more up to date than the last
      //  known "newestFileId" property if the curator/mod author has released a new
      //  version of his collection/mod since the last time the user checked for updates
      const newestFileId: number = mods[key].attributes?.newestFileId;
      const currentFileId: number =
        mods[key].attributes?.fileId ?? mods[key].attributes?.revisionId;
      if (newestFileId !== currentFileId && newestFileId === fileId) {
        mod = mods[key];
      }
    });

  return mod;
}

/**
 * Find any download that matches the given mod reference using all available methods.
 *
 * This function tries multiple matching strategies:
 * 1. Primary lookup via findDownloadByRef
 * 2. Filename match using logicalFileName
 * 3. ModId/FileId match using repo information
 * 4. ModId only match
 * 5. testRefByIdentifiers for fuzzy matching
 *
 * @param reference - Mod reference to match
 * @param downloads - Available downloads to search
 * @returns Download ID if found, null otherwise
 */
export function findDownloadForMod(
  reference: IModReference,
  downloads: { [id: string]: IDownload },
): string | null {
  const relevantDownloads = Object.fromEntries(
    Object.entries(downloads).filter(
      ([dlId, dl]) =>
        dl.state === "finished" && dl.game.includes(reference.gameId),
    ),
  );
  // Try the primary lookup first
  const downloadId = findDownloadByRef(reference, relevantDownloads);
  if (downloadId) {
    return downloadId;
  }

  // Try filename match
  const targetFilename = reference?.logicalFileName;
  if (targetFilename) {
    const altDownloadId = Object.keys(relevantDownloads).find((dlId) => {
      const download = relevantDownloads[dlId];
      return (
        download.localPath &&
        download.localPath.endsWith(targetFilename) &&
        download.state === "finished"
      );
    });
    if (altDownloadId) {
      return altDownloadId;
    }
  }

  // Try modId/fileId match
  if (reference?.repo) {
    const { modId, fileId } = reference.repo;
    if (modId && fileId) {
      const altDownloadId = Object.keys(relevantDownloads).find((dlId) => {
        const download = relevantDownloads[dlId];
        return (
          download.modInfo?.nexus?.ids?.modId?.toString() ===
            modId.toString() &&
          download.modInfo?.nexus?.ids?.fileId?.toString() ===
            fileId.toString() &&
          download.state === "finished"
        );
      });
      if (altDownloadId) {
        return altDownloadId;
      }
    }

    // Try modId only
    if (modId) {
      const altDownloadId = Object.keys(relevantDownloads).find((dlId) => {
        const download = relevantDownloads[dlId];
        return (
          download.modInfo?.nexus?.ids?.modId?.toString() ===
            modId.toString() && download.state === "finished"
        );
      });
      if (altDownloadId) {
        return altDownloadId;
      }
    }
  }

  // Try testRefByIdentifiers
  if (reference) {
    const altDownloadId = Object.keys(relevantDownloads).find((dlId) => {
      const download = relevantDownloads[dlId];
      if (download.state !== "finished") {
        return false;
      }

      const nameSet = new Set<string>();
      const fileIdsSet = new Set<string>();
      fileIdsSet.add(download.modInfo?.nexus?.ids?.fileId?.toString?.());
      nameSet.add(
        download.localPath
          ? path.basename(download.localPath, path.extname(download.localPath))
          : undefined,
      );
      const identifiers = {
        fileNames: Array.from(nameSet).filter(truthy) as string[],
        fileIds: Array.from(fileIdsSet).filter(truthy) as string[],
        gameId:
          download.modInfo?.nexus?.ids?.gameId || download.modInfo?.gameId,
        modId: download.modInfo?.nexus?.ids?.modId,
        fileId: download.modInfo?.nexus?.ids?.fileId,
      };

      if (identifiers.modId && identifiers.fileId && identifiers.gameId) {
        return testRefByIdentifiers(identifiers, reference);
      }

      return false;
    });
    if (altDownloadId) {
      return altDownloadId;
    }
  }

  return null;
}

/**
 * ModLookupService class - provides mod lookup utilities as instance methods.
 *
 * This is a stateless service that provides the same functionality as the
 * standalone functions, but in class form for cases where dependency injection
 * is preferred.
 */
export class ModLookupService {
  /**
   * Check if a mod reference contains fuzzy matching criteria.
   */
  public hasFuzzyReference(ref: IModReference): boolean {
    return hasFuzzyReference(ref);
  }

  /**
   * Find all mod IDs that match a given archive ID (variants of the same mod).
   */
  public checkModVariantsExist(
    api: IExtensionApi,
    gameMode: string,
    archiveId: string,
  ): string[] {
    return checkModVariantsExist(api, gameMode, archiveId);
  }

  /**
   * Check if a mod with the given install name already exists.
   */
  public checkModNameExists(
    installName: string,
    api: IExtensionApi,
    gameMode: string,
  ): string[] {
    return checkModNameExists(installName, api, gameMode);
  }

  /**
   * Find a previous version of a mod by its newest file ID.
   */
  public findPreviousVersionMod(
    fileId: number,
    store: Redux.Store<any>,
    gameMode: string,
    isCollection: boolean,
  ): IMod | undefined {
    return findPreviousVersionMod(fileId, store, gameMode, isCollection);
  }

  /**
   * Find any download that matches the given mod reference.
   */
  public findDownloadForMod(
    reference: IModReference,
    downloads: { [id: string]: IDownload },
  ): string | null {
    return findDownloadForMod(reference, downloads);
  }
}
