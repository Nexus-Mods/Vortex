/**
 * Classifies Stardew Valley archives for installer matcher decisions.
 */
import { RelativePath } from "@vortex/paths";

import { GAME_ID, MOD_MANIFEST } from "../common";
import type { IArchiveClassifierResult, IInstallerTestResult } from "../types";
import {
  type IArchiveEntryPath,
  isArchiveDirectoryEntry,
  toArchiveEntries,
} from "./archivePath";

/**
 * Classifies an archive based on markers used by Stardew Valley installers.
 *
 * Installer `test` functions call this once and then combine the returned
 * booleans for their specific matching rules.
 *
 * @param files Archive entries as logical relative paths; either slash style is
 * accepted and normalized before classifier checks run.
 * @param gameId Vortex game id that requested installer detection.
 * @returns Structured flags describing archive shape and target game match.
 */
export function classifyArchive(
  files: string[],
  gameId: string,
): IArchiveClassifierResult {
  const archiveEntries = toArchiveEntries(files);

  return {
    isGameArchive: gameId === GAME_ID,
    hasManifest: hasManifest(archiveEntries),
    hasContentFolder: hasContentFolder(archiveEntries),
    hasSmapiInstallerDll: hasSmapiInstallerDll(archiveEntries),
  };
}

/**
 * Creates the standard installer test result payload.
 *
 * Stardew Valley installers share the same return structure with an empty
 * `requiredFiles` list, so this helper keeps matcher implementations concise
 * and consistent.
 *
 * @param supported Whether the installer matcher should claim the archive.
 * @returns Installer test result consumed by Vortex.
 */
export function makeInstallerTestResult(
  supported: boolean,
): IInstallerTestResult {
  return {
    supported,
    requiredFiles: [],
  };
}

function hasContentFolder(files: IArchiveEntryPath[]): boolean {
  return files.some(
    (file) =>
      isArchiveDirectoryEntry(file.original) &&
      RelativePath.basenameEquals(file.relative, CONTENT_FOLDER_NAME),
  );
}

function hasManifest(
  files: IArchiveEntryPath[],
  manifestFileName: string = MOD_MANIFEST,
): boolean {
  return files.some((file) => {
    const isManifestFile = RelativePath.basenameEqualsIgnoreCase(
      file.relative,
      manifestFileName,
    );
    const isLocale = RelativePath.segmentsIgnoreCase(
      RelativePath.dirname(file.relative),
    ).includes(LOCALE_SEGMENT);
    return isManifestFile && !isLocale;
  });
}

function hasSmapiInstallerDll(files: IArchiveEntryPath[]): boolean {
  return files.some((file) =>
    RelativePath.basenameEqualsIgnoreCase(file.relative, SMAPI_INSTALLER_DLL),
  );
}

const CONTENT_FOLDER_NAME = "Content";
const LOCALE_SEGMENT = "locale";
const SMAPI_INSTALLER_DLL = "smapi.installer.dll";
