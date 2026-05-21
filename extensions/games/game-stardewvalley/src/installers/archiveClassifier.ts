/**
 * Classifies Stardew Valley archives for installer matcher decisions.
 */
import path from "path";

import { GAME_ID, MOD_MANIFEST } from "../common";
import type { IArchiveClassifierResult, IInstallerTestResult } from "../types";

/**
 * Classifies an archive based on markers used by Stardew Valley installers.
 *
 * Installer `test` functions call this once and then combine the returned
 * booleans for their specific matching rules.
 *
 * @param files Archive entries using platform-native path separators.
 * @param gameId Vortex game id that requested installer detection.
 * @returns Structured flags describing archive shape and target game match.
 */
export function classifyArchive(files: string[], gameId: string): IArchiveClassifierResult {
  return {
    isGameArchive: gameId === GAME_ID,
    hasManifest: hasManifest(files),
    hasContentFolder: hasContentFolder(files),
    hasSmapiInstallerDll: hasSmapiInstallerDll(files),
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
export function makeInstallerTestResult(supported: boolean): IInstallerTestResult {
  return {
    supported,
    requiredFiles: [],
  };
}

function withFakePrefix(filePath: string): string {
  return path.join("fakeDir", filePath);
}

function hasContentFolder(files: string[]): boolean {
  return files
    .filter((file) => file.endsWith(path.sep))
    .map(withFakePrefix)
    .some((file) => file.endsWith(PTRN_CONTENT));
}

function hasManifest(files: string[], manifestFileName: string = MOD_MANIFEST): boolean {
  const manifestName = manifestFileName.toLowerCase();
  return files.some((filePath) => {
    const segments = filePath.toLowerCase().split(path.sep);
    const isManifestFile = segments[segments.length - 1] === manifestName;
    const isLocale = segments.includes("locale");
    return isManifestFile && !isLocale;
  });
}

function hasSmapiInstallerDll(files: string[]): boolean {
  return files.some((file) => path.basename(file).toLowerCase() === SMAPI_INSTALLER_DLL);
}

const PTRN_CONTENT = path.sep + "Content" + path.sep;
const SMAPI_INSTALLER_DLL = "smapi.installer.dll";
