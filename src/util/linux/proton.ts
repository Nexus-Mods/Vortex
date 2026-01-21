import * as path from "path";
import * as fs from "../fs";
import { parse } from "simple-vdf";
import { log } from "../log";

export interface IProtonInfo {
  usesProton: boolean;
  compatDataPath?: string;
  protonPath?: string;
}

/**
 * Check if a game uses Proton by looking for its compatdata folder
 */
export async function detectProtonUsage(
  steamAppsPath: string,
  appId: string,
): Promise<boolean> {
  const compatDataPath = path.join(steamAppsPath, "compatdata", appId);
  try {
    await fs.statAsync(compatDataPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the compatdata path for a game
 */
export function getCompatDataPath(
  steamAppsPath: string,
  appId: string,
): string {
  return path.join(steamAppsPath, "compatdata", appId);
}

/**
 * Get the Wine prefix path within compatdata
 */
export function getWinePrefixPath(compatDataPath: string): string {
  return path.join(compatDataPath, "pfx");
}

/**
 * Read Steam's config.vdf to find the configured Proton version for a game
 */
export async function getConfiguredProtonName(
  steamPath: string,
  appId: string,
): Promise<string | undefined> {
  const configPath = path.join(steamPath, "config", "config.vdf");
  try {
    const configData = await fs.readFileAsync(configPath, "utf8");
    const config = parse(configData.toString()) as any;
    const mapping =
      config?.InstallConfigStore?.Software?.Valve?.Steam?.CompatToolMapping;
    return mapping?.[appId]?.name;
  } catch (err: any) {
    log("debug", "Could not read Steam config.vdf", { error: err?.message });
    return undefined;
  }
}

/**
 * Check if a path exists asynchronously
 */
async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.statAsync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract a searchable keyword from a Proton config name.
 * Config names use formats like "proton_experimental", "proton_9", "proton_hotfix".
 * Returns the portion after "proton_" for fuzzy matching against folder names.
 */
function extractProtonKeyword(protonName: string): string | undefined {
  const lower = protonName.toLowerCase();
  if (!lower.startsWith("proton_")) {
    return undefined;
  }
  return lower.slice("proton_".length);
}

/**
 * Check if a folder name matches a Proton keyword via fuzzy matching.
 * Handles cases like: "proton_experimental" -> "Proton - Experimental"
 *                     "proton_9" -> "Proton 9.0"
 *                     "proton_hotfix" -> "Proton Hotfix"
 */
function folderMatchesKeyword(folderName: string, keyword: string): boolean {
  const lowerFolder = folderName.toLowerCase();

  // Direct substring match (handles "experimental", "hotfix", etc.)
  if (lowerFolder.includes(keyword)) {
    return true;
  }

  // Version number match: "9" should match "9.0", "9.1", etc.
  if (/^\d+$/.test(keyword)) {
    const versionPattern = new RegExp(`\\b${keyword}(\\.\\d+)?\\b`);
    return versionPattern.test(lowerFolder);
  }

  return false;
}

/**
 * Resolve a Proton config name to its installation path.
 *
 * Steam stores the configured Proton version in config.vdf using internal names
 * (e.g., "proton_experimental", "proton_9", "GE-Proton10-28"), but the actual
 * installation folders use different naming conventions:
 *   - config.vdf: "proton_experimental" -> folder: "Proton - Experimental"
 *   - config.vdf: "proton_9"            -> folder: "Proton 9.0"
 *   - config.vdf: "GE-Proton10-28"      -> folder: "GE-Proton10-28" (exact match)
 *
 * Steam provides no direct mapping between these names. Custom tools (GE-Proton, etc.)
 * use matching names, but official Proton versions do not.
 *
 * Resolution strategy (no hardcoded mappings):
 * 1. Custom tools: Check compatibilitytools.d/{name} - custom Proton builds
 *    use their config name as the folder name directly.
 * 2. Exact match: Check steamapps/common/{name} - in case config name matches.
 * 3. Fuzzy match: Scan steamapps/common/Proton* folders and match by keyword.
 *    Extract the keyword after "proton_" and find a folder containing it.
 *
 * This approach is self-maintaining and doesn't require updates when Valve
 * releases new Proton versions.
 */
export async function resolveProtonPath(
  steamPath: string,
  protonName: string,
): Promise<string | undefined> {
  // 1. Check custom compatibility tools directory (GE-Proton, etc.)
  // Custom tools use their config name as the folder name directly
  const customToolPath = path.join(steamPath, "compatibilitytools.d", protonName);
  if (await pathExists(customToolPath)) {
    return customToolPath;
  }

  const commonPath = path.join(steamPath, "steamapps", "common");

  // 2. Check for exact match in steamapps/common
  const exactPath = path.join(commonPath, protonName);
  if (await pathExists(exactPath)) {
    return exactPath;
  }

  // 3. Fuzzy match: scan Proton* folders and match by keyword
  const keyword = extractProtonKeyword(protonName);
  if (keyword) {
    try {
      const entries = await fs.readdirAsync(commonPath);
      const protonDirs = entries.filter((e) =>
        e.toLowerCase().startsWith("proton"),
      );

      for (const dir of protonDirs) {
        if (folderMatchesKeyword(dir, keyword)) {
          return path.join(commonPath, dir);
        }
      }
    } catch (err: any) {
      log("debug", "Could not scan steamapps/common for Proton", {
        error: err?.message,
      });
    }
  }

  return undefined;
}

/**
 * Find the latest installed Proton version (fallback)
 */
export async function findLatestProton(
  steamPath: string,
): Promise<string | undefined> {
  const commonPath = path.join(steamPath, "steamapps", "common");
  try {
    const entries = await fs.readdirAsync(commonPath);
    const protonDirs = entries
      .filter((e) => e.toLowerCase().startsWith("proton"))
      .sort()
      .reverse();

    if (protonDirs.length > 0) {
      return path.join(commonPath, protonDirs[0]);
    }
  } catch (err: any) {
    log("debug", "Could not scan for Proton versions", { error: err?.message });
  }
  return undefined;
}

/**
 * Get full Proton info for a game
 */
export async function getProtonInfo(
  steamPath: string,
  steamAppsPath: string,
  appId: string,
): Promise<IProtonInfo> {
  const usesProton = await detectProtonUsage(steamAppsPath, appId);
  if (!usesProton) {
    return { usesProton: false };
  }

  const compatDataPath = getCompatDataPath(steamAppsPath, appId);

  // Try to get configured Proton, fall back to latest
  const protonName = await getConfiguredProtonName(steamPath, appId);
  let protonPath: string | undefined;

  if (protonName) {
    protonPath = await resolveProtonPath(steamPath, protonName);
  }

  if (!protonPath) {
    protonPath = await findLatestProton(steamPath);
  }

  return { usesProton: true, compatDataPath, protonPath };
}

/**
 * Check if a file is a Windows executable
 */
export function isWindowsExecutable(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return [".exe", ".bat", ".cmd"].includes(ext);
}

/**
 * Build environment variables for running through Proton
 */
export function buildProtonEnvironment(
  compatDataPath: string,
  steamPath: string,
  existingEnv?: Record<string, string>,
): Record<string, string> {
  return {
    ...existingEnv,
    STEAM_COMPAT_DATA_PATH: compatDataPath,
    STEAM_COMPAT_CLIENT_INSTALL_PATH: steamPath,
    WINEPREFIX: getWinePrefixPath(compatDataPath),
  };
}

/**
 * Build the command to run an executable through Proton
 */
export function buildProtonCommand(
  protonPath: string,
  exePath: string,
  args: string[],
): { executable: string; args: string[] } {
  return {
    executable: path.join(protonPath, "proton"),
    args: ["run", exePath, ...args],
  };
}
