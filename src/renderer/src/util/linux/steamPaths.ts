import * as path from "path";
import * as fs from "fs";
import getVortexPath from "../getVortexPath";

/**
 * Default Steam installation paths for Linux systems
 * Ordered by likelihood (most common first)
 */
export function getLinuxSteamPaths(): string[] {
  const home = getVortexPath("home");
  const candidates: string[] = [];

  // ~/.steam/root is a symlink Steam sets to its own installation directory.
  // Resolving it gives the real path regardless of how Steam was installed
  // (apt, snap, flatpak, manual). Check this first so it takes priority over
  // any hardcoded guesses below.
  try {
    const rootLink = path.join(home, ".steam", "root");
    const resolved = fs.realpathSync(rootLink);
    candidates.push(resolved);
  } catch {
    // symlink absent — fall through to hardcoded list
  }

  candidates.push(
    path.join(home, ".local", "share", "Steam"), // XDG standard (native)
    path.join(home, ".steam", "debian-installation"), // Debian/Ubuntu
    path.join(home, ".var", "app", "com.valvesoftware.Steam", "data", "Steam"), // Flatpak
    path.join(
      home,
      ".var",
      "app",
      "com.valvesoftware.Steam",
      ".local",
      "share",
      "Steam",
    ),
    path.join(home, "snap", "steam", "common", ".local", "share", "Steam"), // Snap
    path.join(home, ".steam", "steam"), // Legacy
  );

  // Deduplicate — realpathSync may resolve to one of the hardcoded paths
  return [...new Set(candidates)];
}

/**
 * Check if a path is a valid Steam installation
 */
export function isValidSteamPath(steamPath: string): boolean {
  const libraryFoldersPath = path.join(
    steamPath,
    "config",
    "libraryfolders.vdf",
  );
  try {
    fs.statSync(libraryFoldersPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find the first valid Steam installation path on Linux
 */
export function findLinuxSteamPath(): string | undefined {
  for (const steamPath of getLinuxSteamPaths()) {
    if (isValidSteamPath(steamPath)) {
      return steamPath;
    }
  }
  return undefined;
}

/**
 * Find ALL valid Steam installation paths on Linux.
 * Returns every valid root (native, Flatpak, Snap, etc.)
 */
export function findAllLinuxSteamPaths(): string[] {
  return getLinuxSteamPaths().filter(isValidSteamPath);
}
