/**
 * Classifies Stardew Valley archives for installer matcher decisions.
 */
import { RelativePath } from "@vortex/paths";

import { MOD_MANIFEST } from "../common";
import type { IArchiveClassifierResult, IInstallerTestResult } from "../types";
import {
  type IArchiveEntryPath,
  isArchiveDirectoryEntry,
  toArchiveEntries,
  toLowerCaseSegments,
} from "./archivePath";

/**
 * Classifies an archive based on markers used by Stardew Valley installers.
 *
 * Installer `test` functions call this once and then combine the returned
 * booleans for their specific matching rules.
 *
 * @param files Archive entries as logical relative paths; either slash style is
 * accepted and normalized before classifier checks run.
 * @returns Structured flags describing archive shape.
 */
export function classifyArchive(files: string[]): IArchiveClassifierResult {
  const archiveEntries = toArchiveEntries(files);

  return {
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
      RelativePath.basename(file.relative) === CONTENT_FOLDER_NAME,
  );
}

function hasManifest(
  files: IArchiveEntryPath[],
  manifestFileName: string = MOD_MANIFEST,
): boolean {
  const manifestName = manifestFileName.toLowerCase();
  return files.some((file) => {
    const isManifestFile =
      RelativePath.basename(file.relative).toLowerCase() === manifestName;
    const isLocale = toLowerCaseSegments(
      RelativePath.dirname(file.relative),
    ).includes(LOCALE_SEGMENT);
    return isManifestFile && !isLocale;
  });
}

function hasSmapiInstallerDll(files: IArchiveEntryPath[]): boolean {
  return files.some(
    (file) =>
      RelativePath.basename(file.relative).toLowerCase() ===
      SMAPI_INSTALLER_DLL,
  );
}

const CONTENT_FOLDER_NAME = "Content";
const LOCALE_SEGMENT = "locale";
const SMAPI_INSTALLER_DLL = "smapi.installer.dll";
