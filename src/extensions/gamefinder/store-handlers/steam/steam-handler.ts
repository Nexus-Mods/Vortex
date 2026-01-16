/**
 * Handler for finding games installed via Steam
 */

import { readdirSync, existsSync } from "fs";
import { join } from "path";
import { Result, ok, err } from "neverthrow";
import type { StoreHandler, GameFinderError } from "../../common";
import type { SteamGame, LibraryFolder } from "./types";
import { createSteamGame, StateFlags } from "./types";
import {
  findSteamPath,
  getLibraryFoldersPath,
  getSteamAppsPath,
} from "./steam-location-finder";
import { parseLibraryFolders } from "./library-folders-parser";
import { parseAppManifest } from "./app-manifest-parser";

/**
 * Handler for finding games installed via Steam
 */
export class SteamHandler implements StoreHandler {
  readonly storeName = "Steam";

  private steamPath: string | null = null;

  /**
   * Find all games installed via Steam
   */
  async findAllGames(): Promise<Result<SteamGame[], GameFinderError>> {
    // Find Steam installation
    const steamPathResult = await findSteamPath();
    if (steamPathResult.isErr()) {
      return err(steamPathResult.error);
    }

    this.steamPath = steamPathResult.value;

    // Parse library folders
    const libraryFoldersPath = getLibraryFoldersPath(this.steamPath);
    const libraryFoldersResult = parseLibraryFolders(libraryFoldersPath);
    if (libraryFoldersResult.isErr()) {
      return err(libraryFoldersResult.error);
    }

    const libraryFolders = libraryFoldersResult.value;
    const games: SteamGame[] = [];

    // Iterate through each library folder
    for (const libraryFolder of libraryFolders) {
      const gamesResult = this.findGamesInLibrary(libraryFolder);
      if (gamesResult.isOk()) {
        games.push(...gamesResult.value);
      }
      // Continue with other libraries even if one has errors
    }

    return ok(games);
  }

  /**
   * Find all games in a specific library folder
   */
  private findGamesInLibrary(
    libraryFolder: LibraryFolder,
  ): Result<SteamGame[], GameFinderError> {
    const steamAppsPath = getSteamAppsPath(libraryFolder.path);

    if (!existsSync(steamAppsPath)) {
      return ok([]);
    }

    // Find all appmanifest_*.acf files
    let manifestFiles: string[];
    try {
      manifestFiles = readdirSync(steamAppsPath)
        .filter(
          (file) => file.startsWith("appmanifest_") && file.endsWith(".acf"),
        )
        .map((file) => join(steamAppsPath, file));
    } catch (error) {
      return err({
        code: "LIBRARY_READ_ERROR",
        message: `Failed to read library folder: ${steamAppsPath}`,
        cause: error instanceof Error ? error : new Error(String(error)),
      });
    }

    const games: SteamGame[] = [];

    for (const manifestPath of manifestFiles) {
      const manifestResult = parseAppManifest(manifestPath);
      if (manifestResult.isErr()) {
        // Skip games that fail to parse
        continue;
      }

      const appManifest = manifestResult.value;

      // Skip games that aren't fully installed
      if (!this.isFullyInstalled(appManifest.stateFlags)) {
        continue;
      }

      // Skip games where the installation directory doesn't exist
      if (!existsSync(appManifest.installationDirectory)) {
        continue;
      }

      games.push(createSteamGame(appManifest, libraryFolder, this.steamPath!));
    }

    return ok(games);
  }

  /**
   * Check if a game is fully installed based on state flags
   */
  private isFullyInstalled(stateFlags: StateFlags): boolean {
    // Must have FullyInstalled flag
    if ((stateFlags & StateFlags.FullyInstalled) === 0) {
      return false;
    }

    // Must not be in any problematic state
    const problematicStates =
      StateFlags.Uninstalled |
      StateFlags.FilesMissing |
      StateFlags.FilesCorrupt |
      StateFlags.UpdateRunning |
      StateFlags.Downloading |
      StateFlags.Uninstalling;

    return (stateFlags & problematicStates) === 0;
  }

  /**
   * Check if Steam is available on this system
   */
  async isAvailable(): Promise<boolean> {
    const result = await findSteamPath();
    return result.isOk();
  }

  /**
   * Get the Steam installation path (available after findAllGames)
   */
  getSteamPath(): string | null {
    return this.steamPath;
  }
}
