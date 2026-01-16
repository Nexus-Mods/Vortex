/**
 * Handler for finding games installed via Epic Games Store
 */

import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { homedir, platform } from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { Result, ok, err } from "neverthrow";
import type { StoreHandler, GameFinderError } from "../../common";
import type { EGSGame, EGSManifestFile } from "./types";
import { createEGSGame } from "./types";

const execAsync = promisify(exec);

/**
 * Get the default Epic Games manifest directory
 */
function getDefaultManifestDirectory(): string {
  const home = homedir();

  switch (platform()) {
    case "win32": {
      const localAppData =
        process.env["LOCALAPPDATA"] ?? join(home, "AppData", "Local");
      return join(
        localAppData,
        "Epic",
        "EpicGamesLauncher",
        "Data",
        "Manifests",
      );
    }

    case "darwin":
      return join(
        home,
        "Library",
        "Application Support",
        "Epic",
        "EpicGamesLauncher",
        "Data",
        "Manifests",
      );

    case "linux":
      // Epic doesn't have native Linux support, but Heroic uses a similar structure
      // For now, return a path that won't exist
      return join(
        home,
        ".config",
        "Epic",
        "EpicGamesLauncher",
        "Data",
        "Manifests",
      );

    default:
      return "";
  }
}

/**
 * Try to get manifest directory from Windows Registry
 */
async function getManifestDirectoryFromRegistry(): Promise<string | undefined> {
  if (platform() !== "win32") {
    return undefined;
  }

  try {
    const { stdout } = await execAsync(
      'reg query "HKCU\\Software\\Epic Games\\EOS" /v ModSdkMetadataDir',
      { encoding: "utf8" },
    );

    const match = /ModSdkMetadataDir\s+REG_SZ\s+(.+)/i.exec(stdout);
    if (match?.[1]) {
      const dir = match[1].trim();
      if (existsSync(dir)) {
        return dir;
      }
    }
  } catch {
    // Registry key not found
  }

  return undefined;
}

/**
 * Parse a manifest .item file
 */
function parseManifestFile(
  filePath: string,
): Result<EGSManifestFile, GameFinderError> {
  try {
    const content = readFileSync(filePath, "utf8");
    const manifest = JSON.parse(content) as Partial<EGSManifestFile>;

    // Validate required fields
    if (
      typeof manifest.CatalogItemId !== "string" ||
      manifest.CatalogItemId === ""
    ) {
      return err({
        code: "EGS_MISSING_CATALOG_ID",
        message: `Missing CatalogItemId in manifest: ${filePath}`,
      });
    }

    if (
      typeof manifest.DisplayName !== "string" ||
      manifest.DisplayName === ""
    ) {
      return err({
        code: "EGS_MISSING_DISPLAY_NAME",
        message: `Missing DisplayName in manifest: ${filePath}`,
      });
    }

    if (
      typeof manifest.InstallLocation !== "string" ||
      manifest.InstallLocation === ""
    ) {
      return err({
        code: "EGS_MISSING_INSTALL_LOCATION",
        message: `Missing InstallLocation in manifest: ${filePath}`,
      });
    }

    if (typeof manifest.ManifestHash !== "string") {
      return err({
        code: "EGS_MISSING_MANIFEST_HASH",
        message: `Missing ManifestHash in manifest: ${filePath}`,
      });
    }

    if (typeof manifest.MainGameCatalogItemId !== "string") {
      return err({
        code: "EGS_MISSING_MAIN_GAME_ID",
        message: `Missing MainGameCatalogItemId in manifest: ${filePath}`,
      });
    }

    return ok({
      CatalogItemId: manifest.CatalogItemId,
      DisplayName: manifest.DisplayName,
      InstallLocation: manifest.InstallLocation,
      ManifestHash: manifest.ManifestHash,
      MainGameCatalogItemId: manifest.MainGameCatalogItemId,
    });
  } catch (error) {
    return err({
      code: "EGS_MANIFEST_PARSE_ERROR",
      message: `Failed to parse manifest: ${filePath}`,
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

/**
 * Handler for finding games installed via Epic Games Store
 */
export class EpicHandler implements StoreHandler {
  readonly storeName = "Epic Games Store";

  private manifestDirectory: string | null = null;

  /**
   * Find all games installed via Epic Games Store
   */
  async findAllGames(): Promise<Result<EGSGame[], GameFinderError>> {
    // Try to find manifest directory
    const registryDir = await getManifestDirectoryFromRegistry();
    const defaultDir = getDefaultManifestDirectory();

    this.manifestDirectory = registryDir ?? defaultDir;

    if (!existsSync(this.manifestDirectory)) {
      // Epic Games Launcher not installed or no games
      return ok([]);
    }

    // Find all .item files
    let manifestFiles: string[];
    try {
      manifestFiles = readdirSync(this.manifestDirectory)
        .filter((file) => file.endsWith(".item"))
        .map((file) => join(this.manifestDirectory!, file));
    } catch (error) {
      return err({
        code: "EGS_DIRECTORY_READ_ERROR",
        message: `Failed to read manifest directory: ${this.manifestDirectory}`,
        cause: error instanceof Error ? error : new Error(String(error)),
      });
    }

    if (manifestFiles.length === 0) {
      return ok([]);
    }

    // Parse all manifests
    const manifests: EGSManifestFile[] = [];
    for (const file of manifestFiles) {
      const result = parseManifestFile(file);
      if (result.isOk()) {
        manifests.push(result.value);
      }
      // Skip failed manifests
    }

    // Group manifests by MainGameCatalogItemId
    const groupedByMainGame = new Map<string, EGSManifestFile[]>();
    for (const manifest of manifests) {
      const key = manifest.MainGameCatalogItemId.toLowerCase();
      const existing = groupedByMainGame.get(key) ?? [];
      existing.push(manifest);
      groupedByMainGame.set(key, existing);
    }

    // Create games from grouped manifests
    const games: EGSGame[] = [];
    for (const [_mainGameId, group] of groupedByMainGame) {
      const primaryManifest = group[0];
      if (primaryManifest === undefined) {
        continue;
      }

      // Collect all manifest hashes
      const manifestHashes = group.map((m) => m.ManifestHash);

      // Verify installation directory exists
      if (!existsSync(primaryManifest.InstallLocation)) {
        continue;
      }

      games.push(
        createEGSGame(
          primaryManifest.MainGameCatalogItemId,
          primaryManifest.DisplayName,
          primaryManifest.InstallLocation,
          manifestHashes,
        ),
      );
    }

    return ok(games);
  }

  /**
   * Check if Epic Games Store is available on this system
   */
  async isAvailable(): Promise<boolean> {
    const registryDir = await getManifestDirectoryFromRegistry();
    const defaultDir = getDefaultManifestDirectory();
    const dir = registryDir ?? defaultDir;

    return existsSync(dir);
  }

  /**
   * Get the manifest directory (available after findAllGames)
   */
  getManifestDirectory(): string | null {
    return this.manifestDirectory;
  }
}
