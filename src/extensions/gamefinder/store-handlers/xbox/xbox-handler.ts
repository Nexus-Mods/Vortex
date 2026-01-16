/**
 * Handler for finding games installed via Xbox Game Pass
 * Uses filesystem-based approach to find appxmanifest.xml files
 */

import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { platform } from "os";
import { Result, ok, err } from "neverthrow";
import type { StoreHandler, GameFinderError } from "../../common";
import type { XboxGame } from "./types";
import { parseGamingRootFile } from "./gaming-root-parser";
import { parseAppxManifest } from "./appxmanifest-parser";

/**
 * Get all available drive letters on Windows
 */
function getDriveLetters(): string[] {
  if (platform() !== "win32") {
    return [];
  }

  const drives: string[] = [];
  // Check drives A-Z
  for (let i = 65; i <= 90; i++) {
    const drive = `${String.fromCharCode(i)}:\\`;
    if (existsSync(drive)) {
      drives.push(drive);
    }
  }
  return drives;
}

/**
 * Get app folders from a drive by reading .GamingRoot file and ModifiableWindowsApps
 */
function getAppFoldersFromDrive(
  drivePath: string,
): Result<string[], GameFinderError[]> {
  const paths: string[] = [];
  const errors: GameFinderError[] = [];

  // Check for ModifiableWindowsApps directory
  const modifiableWindowsAppsPath = join(
    drivePath,
    "Program Files",
    "ModifiableWindowsApps",
  );
  const gamingRootFilePath = join(drivePath, ".GamingRoot");

  const modifiableWindowsAppsExists = existsSync(modifiableWindowsAppsPath);
  const gamingRootFileExists = existsSync(gamingRootFilePath);

  if (modifiableWindowsAppsExists) {
    paths.push(modifiableWindowsAppsPath);
  }

  if (!modifiableWindowsAppsExists && !gamingRootFileExists) {
    // Neither exists, which is fine - just means no Xbox games on this drive
    return ok(paths);
  }

  if (gamingRootFileExists) {
    const parseResult = parseGamingRootFile(gamingRootFilePath);
    if (parseResult.isOk()) {
      // Convert relative paths to absolute paths based on the drive
      const absolutePaths = parseResult.value.map((relativePath) =>
        join(drivePath, relativePath),
      );
      paths.push(...absolutePaths);
    } else {
      errors.push(parseResult.error);
    }
  }

  return errors.length > 0 ? err(errors) : ok(paths);
}

/**
 * Get all app folders across all drives
 */
function getAllAppFolders(): { paths: string[]; errors: GameFinderError[] } {
  const allPaths: string[] = [];
  const allErrors: GameFinderError[] = [];

  const drives = getDriveLetters();

  for (const drive of drives) {
    const result = getAppFoldersFromDrive(drive);
    if (result.isOk()) {
      allPaths.push(...result.value);
    } else {
      allErrors.push(...result.error);
    }
  }

  return { paths: allPaths, errors: allErrors };
}

/**
 * Parse an appxmanifest.xml file and create an XboxGame
 */
function parseManifestAndCreateGame(
  manifestPath: string,
  installPath: string,
): Result<XboxGame, GameFinderError> {
  const parseResult = parseAppxManifest(manifestPath);

  if (parseResult.isErr()) {
    return err(parseResult.error);
  }

  const { identityName, displayName } = parseResult.value;

  return ok({
    id: identityName,
    name: displayName,
    path: installPath,
    store: "xbox",
    productId: identityName,
  });
}

/**
 * Find all games in a given app folder
 */
function findGamesInAppFolder(appFolderPath: string): XboxGame[] {
  const games: XboxGame[] = [];

  if (!existsSync(appFolderPath)) {
    return games;
  }

  let directories: string[];
  try {
    directories = readdirSync(appFolderPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => join(appFolderPath, dirent.name));
  } catch {
    return games;
  }

  for (const directory of directories) {
    let manifestPath = join(directory, "appxmanifest.xml");
    let installPath = directory;

    // Check if manifest exists directly in the directory
    if (!existsSync(manifestPath)) {
      // Check in Content subdirectory
      const contentDirectory = join(directory, "Content");
      if (existsSync(contentDirectory)) {
        const contentManifestPath = join(contentDirectory, "appxmanifest.xml");
        if (existsSync(contentManifestPath)) {
          manifestPath = contentManifestPath;
          installPath = contentDirectory;
        } else {
          continue; // No manifest found
        }
      } else {
        continue; // No manifest and no Content directory
      }
    }

    const gameResult = parseManifestAndCreateGame(manifestPath, installPath);
    if (gameResult.isOk()) {
      games.push(gameResult.value);
    }
  }

  return games;
}

/**
 * Handler for finding games installed via Xbox Game Pass
 */
export class XboxHandler implements StoreHandler {
  readonly storeName = "Xbox Game Pass";

  /**
   * Find all games installed via Xbox Game Pass
   */
  async findAllGames(): Promise<Result<XboxGame[], GameFinderError>> {
    // Xbox Game Pass is Windows-only
    if (platform() !== "win32") {
      return ok([]);
    }

    const { paths, errors } = getAllAppFolders();

    if (paths.length === 0 && errors.length > 0) {
      // Return first error if we couldn't find any paths
      const firstError = errors[0];
      if (firstError) {
        return err(firstError);
      }
    }

    const allGames: XboxGame[] = [];

    for (const appFolder of paths) {
      const games = findGamesInAppFolder(appFolder);
      allGames.push(...games);
    }

    return ok(allGames);
  }

  /**
   * Check if Xbox Game Pass is available on this system
   */
  async isAvailable(): Promise<boolean> {
    if (platform() !== "win32") {
      return false;
    }

    const { paths } = getAllAppFolders();
    return paths.length > 0;
  }
}
