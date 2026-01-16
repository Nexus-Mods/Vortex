/**
 * Steam installation location finder
 * Supports Windows, Linux, and macOS
 */

import { existsSync } from "fs";
import { join } from "path";
import { homedir, platform } from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { Result, ok, err } from "neverthrow";
import type { GameFinderError } from "../../common";

const execAsync = promisify(exec);

/**
 * Get the default Steam installation paths for the current platform
 */
function getDefaultSteamPaths(): string[] {
  const home = homedir();

  switch (platform()) {
    case "win32": {
      const programFiles =
        process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
      return [join(programFiles, "Steam")];
    }

    case "linux":
      return [
        // XDG standard location
        join(home, ".local", "share", "Steam"),
        // Debian/Ubuntu symlink
        join(home, ".steam", "debian-installation"),
        // Flatpak locations
        join(home, ".var", "app", "com.valvesoftware.Steam", "data", "Steam"),
        join(
          home,
          ".var",
          "app",
          "com.valvesoftware.Steam",
          ".local",
          "share",
          "Steam",
        ),
        // Snap location
        join(home, "snap", "steam", "common", ".local", "share", "Steam"),
        // Legacy locations
        join(home, ".steam", "steam"),
        join(home, ".steam"),
        join(home, ".local", ".steam"),
      ];

    case "darwin":
      return [join(home, "Library", "Application Support", "Steam")];

    default:
      return [];
  }
}

/**
 * Try to find Steam path from Windows registry
 * Returns null on non-Windows platforms or if not found
 */
async function findSteamPathFromRegistry(): Promise<string | null> {
  if (platform() !== "win32") {
    return null;
  }

  try {
    const { stdout } = await execAsync(
      'reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath',
      {
        encoding: "utf8",
      },
    );

    // Parse registry output: "    SteamPath    REG_SZ    C:\Program Files (x86)\Steam"
    const match = /SteamPath\s+REG_SZ\s+(.+)/i.exec(stdout);
    if (match?.[1]) {
      return match[1].trim();
    }
  } catch {
    // Registry key not found or other error
  }

  return null;
}

/**
 * Validate that a path is a valid Steam installation
 */
function isValidSteamPath(steamPath: string): boolean {
  if (!existsSync(steamPath)) {
    return false;
  }

  // Check for libraryfolders.vdf which is required
  const libraryFoldersPath = join(steamPath, "config", "libraryfolders.vdf");
  return existsSync(libraryFoldersPath);
}

/**
 * Find the Steam installation path on the current system
 */
export async function findSteamPath(): Promise<
  Result<string, GameFinderError>
> {
  // Try default paths first
  const defaultPaths = getDefaultSteamPaths();

  for (const steamPath of defaultPaths) {
    if (isValidSteamPath(steamPath)) {
      return ok(steamPath);
    }
  }

  // Try Windows registry as fallback
  const registryPath = await findSteamPathFromRegistry();
  if (registryPath !== null && isValidSteamPath(registryPath)) {
    return ok(registryPath);
  }

  return err({
    code: "STEAM_NOT_FOUND",
    message: `Steam installation not found. Searched paths: ${defaultPaths.join(", ")}`,
  });
}

/**
 * Get the path to libraryfolders.vdf
 */
export function getLibraryFoldersPath(steamPath: string): string {
  return join(steamPath, "config", "libraryfolders.vdf");
}

/**
 * Get the steamapps directory for a library folder
 */
export function getSteamAppsPath(libraryPath: string): string {
  return join(libraryPath, "steamapps");
}

/**
 * Get the common directory where games are installed
 */
export function getCommonPath(libraryPath: string): string {
  return join(libraryPath, "steamapps", "common");
}
