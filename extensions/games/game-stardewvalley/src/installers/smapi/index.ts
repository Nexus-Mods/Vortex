/**
 * Detects and installs SMAPI archives for Stardew Valley.
 *
 * Platform-specific values are defined in sibling files:
 * - windows.ts
 * - linux.ts
 * - macos.ts (stubbed darwin variant)
 */
import Bluebird from "bluebird";
import path from "path";
import { fs, log, util } from "vortex-api";
import type { types } from "vortex-api";

import { _SMAPI_BUNDLED_MODS, getBundledMods } from "../../common";
import type { IInstallerTestResult } from "../../types";
import { classifyArchive, makeInstallerTestResult } from "../archiveClassifier";
import { linuxSMAPIPlatform } from "./linux";
import { macosSMAPIPlatform } from "./macos";
import type { ISMAPIPlatformVariant } from "./types";
import { windowsSMAPIPlatform } from "./windows";

/**
 * Resolve which SMAPI platform variant to use for installer behaviour.
 *
 * @param nodePlatform Optional override; defaults to `process.platform`.
 * This is mainly exposed to keep tests deterministic without mocking
 * `process.platform`.
 */
export function resolveSMAPIPlatform(
  nodePlatform: NodeJS.Platform = process.platform,
): ISMAPIPlatformVariant {
  switch (nodePlatform) {
    case "win32":
      return windowsSMAPIPlatform;
    case "linux":
      return linuxSMAPIPlatform;
    case "darwin":
      return macosSMAPIPlatform;
    default:
      throw new Error(
        `Unsupported platform for SMAPI installer: ${nodePlatform}`,
      );
  }
}

/**
 * Canonical SMAPI executable file name for the current host platform.
 */
export const SMAPI_EXE = resolveSMAPIPlatform().executableName;

/**
 * Detects whether a set of install instructions contains the SMAPI executable.
 *
 * @param platform Optional override; defaults to `resolveSMAPIPlatform()`.
 * The explicit parameter is primarily for tests so platform behaviour can be
 * validated independently.
 */
export function isSMAPIModType(
  instructions: types.IInstruction[],
  platform: ISMAPIPlatformVariant = resolveSMAPIPlatform(),
): Bluebird<boolean> {
  const expectedExecutable = platform.executableName.toLowerCase();
  const smapiData = instructions.find(
    (inst) =>
      inst.type === "copy" &&
      typeof inst.source === "string" &&
      archiveFileName(inst.source).toLowerCase() === expectedExecutable,
  );

  return Bluebird.resolve(smapiData !== undefined);
}

/** Tests whether an archive contains the SMAPI installer payload. */
export function testSMAPI(
  files: string[],
  gameId: string,
): Bluebird<IInstallerTestResult> {
  const archiveInfo = classifyArchive(files, gameId);
  const supported =
    archiveInfo.isGameArchive && archiveInfo.hasSmapiInstallerDll;
  return Bluebird.resolve(makeInstallerTestResult(supported));
}

/**
 * Extracts platform-specific SMAPI files and returns installation instructions.
 *
 * @param platform Optional override; defaults to `resolveSMAPIPlatform()`.
 * This is mainly intended for tests, where platform-specific install behaviour
 * should be exercised without changing host platform state.
 */
export async function installSMAPI(
  getGameInstallPath: () => string,
  files: string[],
  destinationPath: string,
  platform: ISMAPIPlatformVariant = resolveSMAPIPlatform(),
): Promise<types.IInstallResult> {
  if (!platform.implemented) {
    return Promise.reject(
      new util.DataInvalid(
        platform.unsupportedReason ??
          "SMAPI automatic installation is not implemented for this platform.",
      ),
    );
  }

  const platformDataFiles = new Set(
    platform.dataFiles.map((fileName) => fileName.toLowerCase()),
  );
  const dataFile = files.find(
    (file) =>
      isCorrectPlatformPath(file, platform.archiveFolder) &&
      platformDataFiles.has(archiveFileName(file).toLowerCase()),
  );

  if (dataFile === undefined) {
    return Promise.reject(
      new util.DataInvalid(
        "Failed to find the SMAPI data files - download appears " +
          "to be corrupted; please re-download SMAPI and try again",
      ),
    );
  }

  let data = "";
  try {
    data = await fs.readFileAsync(
      path.join(getGameInstallPath(), "Stardew Valley.deps.json"),
      { encoding: "utf8" },
    );
  } catch (err) {
    log("error", "failed to parse SDV dependencies", err);
  }

  // File list provided by Vortex is outdated after extraction.
  const updatedFiles: string[] = [];

  const szip = new (util.SevenZip as any)();
  await szip.extractFull(path.join(destinationPath, dataFile), destinationPath);

  await util.walk(destinationPath, (iter, stats) => {
    const relPath = normalizePathSeparators(
      path.relative(destinationPath, iter),
    );

    // Filter out files from the original install as they're no longer required.
    if (
      !files.includes(relPath) &&
      stats.isFile() &&
      !files.includes(relPath + "/")
    ) {
      updatedFiles.push(relPath);
    }

    const segments = splitArchivePath(relPath).map((seg) => seg.toLowerCase());
    const modsFolderIdx = segments.indexOf("mods");
    if (modsFolderIdx !== -1) {
      const bundledMod = segments[modsFolderIdx + 1];
      if (bundledMod !== undefined) {
        _SMAPI_BUNDLED_MODS.push(bundledMod);
      }
    }

    return Bluebird.resolve();
  });

  const expectedExecutable = platform.executableName.toLowerCase();
  const smapiExe = updatedFiles.find(
    (file) => archiveFileName(file).toLowerCase() === expectedExecutable,
  );
  if (smapiExe === undefined) {
    return Promise.reject(
      new util.DataInvalid(
        `Failed to extract ${platform.executableName} - download appears ` +
          "to be corrupted; please re-download SMAPI and try again",
      ),
    );
  }

  const smapiExeBaseName = archiveFileName(smapiExe);
  const idx = smapiExe.indexOf(smapiExeBaseName);

  const instructions: types.IInstruction[] = updatedFiles.map((file) => ({
    type: "copy",
    source: file,
    destination: file.substr(idx),
  }));

  instructions.push({
    type: "attribute",
    key: "smapiBundledMods",
    value: getBundledMods(),
  });

  instructions.push({
    type: "generatefile",
    data,
    destination: "StardewModdingAPI.deps.json",
  });

  return Promise.resolve({ instructions });
}

/**
 * Split a path from archive entries into normalised segments.
 *
 * Examples:
 * - `internal\\windows\\install.dat` -> [`internal`, `windows`, `install.dat`]
 * - `internal/linux/install.dat` -> [`internal`, `linux`, `install.dat`]
 */
function splitArchivePath(filePath: string): string[] {
  return normalizePathSeparators(filePath)
    .split("/")
    .filter((segment) => segment.length > 0);
}

function normalizePathSeparators(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

/**
 * Return the final path segment for an archive entry.
 *
 * Examples:
 * - `internal/windows/StardewModdingAPI.exe` -> `StardewModdingAPI.exe`
 * - `internal\\linux\\install.dat` -> `install.dat`
 */
function archiveFileName(filePath: string): string {
  const segments = splitArchivePath(filePath);
  const lastSegment = segments.pop();
  return lastSegment ?? filePath;
}

/**
 * Check whether the path contains a platform folder segment.
 *
 * Examples:
 * - `internal/windows/install.dat`, `windows` -> `true`
 * - `internal/linux/install.dat`, `windows` -> `false`
 */
function isCorrectPlatformPath(
  filePath: string,
  platformFolder: string,
): boolean {
  const segments = splitArchivePath(filePath).map((seg) => seg.toLowerCase());
  return segments.includes(platformFolder.toLowerCase());
}

export { windowsSMAPIPlatform, linuxSMAPIPlatform, macosSMAPIPlatform };
export type { ISMAPIPlatformVariant } from "./types";
