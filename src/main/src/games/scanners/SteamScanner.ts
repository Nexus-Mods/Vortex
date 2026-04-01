import * as fs from "node:fs/promises";
import { statSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { parse } from "simple-vdf";
import * as winapi from "winapi-bindings";

import { log } from "../../logging";
import type { IStoreGameEntry, IStoreScanner } from "../IStoreScanner";

/**
 * Scans Steam for all installed games by reading app manifests.
 *
 * Supports Windows (registry) and Linux (known paths).
 * On Linux, includes Proton compatibility metadata.
 */
export class SteamScanner implements IStoreScanner {
  public readonly storeType = "steam";

  public async isAvailable(): Promise<boolean> {
    return (await this.#findBasePath()) !== undefined;
  }

  public async scan(): Promise<IStoreGameEntry[]> {
    const basePath = await this.#findBasePath();
    if (basePath === undefined) {
      return [];
    }

    const libraryPaths = await this.#resolveLibraryPaths(basePath);
    const entries: IStoreGameEntry[] = [];

    for (const libPath of libraryPaths) {
      try {
        const games = await this.#parseLibrary(basePath, libPath);
        entries.push(...games);
      } catch (err) {
        log("warn", "steam-scanner: failed to read library", {
          path: libPath,
          error: String(err),
        });
      }
    }

    log("info", "steam-scanner: completed", { count: entries.length });
    return entries;
  }

  async #findBasePath(): Promise<string | undefined> {
    if (process.platform === "win32") {
      try {
        const result = winapi.RegGetValue(
          "HKEY_CURRENT_USER",
          "Software\\Valve\\Steam",
          "SteamPath",
        );
        return result.value as string;
      } catch {
        return undefined;
      }
    }

    // Linux: check known Steam installation paths
    return findLinuxSteamPath();
  }

  async #resolveLibraryPaths(basePath: string): Promise<string[]> {
    const steamPaths: string[] = [basePath];
    const vdfPath = path.join(basePath, "config", "libraryfolders.vdf");

    try {
      const data = await fs.readFile(vdfPath, "utf8");
      const parsed = parse(data) as Record<string, unknown>;
      const libObj = (parsed as any)?.libraryfolders ?? {};

      let counter = Object.prototype.hasOwnProperty.call(libObj, "0") ? 0 : 1;
      while (Object.prototype.hasOwnProperty.call(libObj, `${counter}`)) {
        const libPath = libObj[`${counter}`]?.path;
        if (libPath && !steamPaths.includes(libPath)) {
          steamPaths.push(libPath);
        }
        counter++;
      }
    } catch (err) {
      log("warn", "steam-scanner: failed to read libraryfolders.vdf", {
        error: String(err),
      });
    }

    return steamPaths;
  }

  async #parseLibrary(
    basePath: string,
    libPath: string,
  ): Promise<IStoreGameEntry[]> {
    const steamAppsPath = path.join(libPath, "steamapps");
    let files: string[];
    try {
      files = await fs.readdir(steamAppsPath);
    } catch {
      // Library folder doesn't exist (e.g., removable media)
      return [];
    }

    const manifests = files.filter(
      (f) => f.startsWith("appmanifest_") && f.endsWith(".acf"),
    );

    const entries: IStoreGameEntry[] = [];

    for (const manifest of manifests) {
      try {
        const data = await fs.readFile(
          path.join(steamAppsPath, manifest),
          "utf8",
        );
        const parsed = parse(data) as any;
        const appState = parsed?.AppState;

        if (!appState?.appid || !appState?.installdir) {
          continue;
        }

        const gamePath = path.join(
          steamAppsPath,
          "common",
          appState.installdir,
        );

        const metadata: Record<string, unknown> = {
          lastUser: appState.LastOwner,
          lastUpdated: appState.LastUpdated
            ? Number(appState.LastUpdated) * 1000
            : undefined,
        };

        // Add Proton info on Linux
        if (process.platform !== "win32") {
          try {
            const protonInfo = await getProtonInfo(
              basePath,
              steamAppsPath,
              appState.appid,
            );
            if (protonInfo.usesProton) {
              metadata.usesProton = true;
              metadata.compatDataPath = protonInfo.compatDataPath;
              metadata.protonPath = protonInfo.protonPath;
            }
          } catch {
            // Proton info is best-effort
          }
        }

        entries.push({
          storeId: appState.appid,
          installPath: gamePath,
          name: appState.name,
          metadata,
        });
      } catch (err) {
        log("debug", "steam-scanner: failed to parse manifest", {
          manifest,
          error: String(err),
        });
      }
    }

    return entries;
  }
}

// --- Linux Steam path detection ---

function getLinuxSteamPaths(): string[] {
  const home = os.homedir();
  return [
    path.join(home, ".local", "share", "Steam"),
    path.join(home, ".steam", "debian-installation"),
    path.join(home, ".var", "app", "com.valvesoftware.Steam", "data", "Steam"),
    path.join(
      home,
      ".var",
      "app",
      "com.valvesoftware.Steam",
      ".local",
      "share",
      "Steam",
    ),
    path.join(home, "snap", "steam", "common", ".local", "share", "Steam"),
    path.join(home, ".steam", "steam"),
  ];
}

function isValidSteamPath(steamPath: string): boolean {
  const libraryFoldersPath = path.join(
    steamPath,
    "config",
    "libraryfolders.vdf",
  );
  try {
    statSync(libraryFoldersPath);
    return true;
  } catch {
    return false;
  }
}

function findLinuxSteamPath(): string | undefined {
  for (const steamPath of getLinuxSteamPaths()) {
    if (isValidSteamPath(steamPath)) {
      return steamPath;
    }
  }
  return undefined;
}

// --- Proton detection (Linux only) ---

interface IProtonInfo {
  usesProton: boolean;
  compatDataPath?: string;
  protonPath?: string;
}

async function detectProtonUsage(
  steamAppsPath: string,
  appId: string,
): Promise<boolean> {
  try {
    await fs.stat(path.join(steamAppsPath, "compatdata", appId));
    return true;
  } catch {
    return false;
  }
}

async function getConfiguredProtonName(
  steamPath: string,
  appId: string,
): Promise<string | undefined> {
  try {
    const configData = await fs.readFile(
      path.join(steamPath, "config", "config.vdf"),
      "utf8",
    );
    const config = parse(configData) as any;
    return config?.InstallConfigStore?.Software?.Valve?.Steam
      ?.CompatToolMapping?.[appId]?.name;
  } catch {
    return undefined;
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function extractProtonKeyword(protonName: string): string | undefined {
  const lower = protonName.toLowerCase();
  return lower.startsWith("proton_") ? lower.slice("proton_".length) : undefined;
}

function folderMatchesKeyword(folderName: string, keyword: string): boolean {
  const lower = folderName.toLowerCase();
  if (lower.includes(keyword)) return true;
  if (/^\d+$/.test(keyword)) {
    return new RegExp(`\\b${keyword}(\\.\\d+)?\\b`).test(lower);
  }
  return false;
}

async function resolveProtonPath(
  steamPath: string,
  protonName: string,
): Promise<string | undefined> {
  // Custom compatibility tools (GE-Proton, etc.)
  const customToolPath = path.join(
    steamPath,
    "compatibilitytools.d",
    protonName,
  );
  if (await pathExists(customToolPath)) return customToolPath;

  const commonPath = path.join(steamPath, "steamapps", "common");

  // Exact match
  const exactPath = path.join(commonPath, protonName);
  if (await pathExists(exactPath)) return exactPath;

  // Fuzzy match
  const keyword = extractProtonKeyword(protonName);
  if (keyword) {
    try {
      const entries = await fs.readdir(commonPath);
      for (const dir of entries) {
        if (
          dir.toLowerCase().startsWith("proton") &&
          folderMatchesKeyword(dir, keyword)
        ) {
          return path.join(commonPath, dir);
        }
      }
    } catch {
      // Best effort
    }
  }

  return undefined;
}

async function findLatestProton(
  steamPath: string,
): Promise<string | undefined> {
  const commonPath = path.join(steamPath, "steamapps", "common");
  try {
    const entries = await fs.readdir(commonPath);
    const protonDirs = entries
      .filter((e) => e.toLowerCase().startsWith("proton"))
      .sort()
      .reverse();
    return protonDirs.length > 0
      ? path.join(commonPath, protonDirs[0])
      : undefined;
  } catch {
    return undefined;
  }
}

async function getProtonInfo(
  steamPath: string,
  steamAppsPath: string,
  appId: string,
): Promise<IProtonInfo> {
  const usesProton = await detectProtonUsage(steamAppsPath, appId);
  if (!usesProton) return { usesProton: false };

  const compatDataPath = path.join(steamAppsPath, "compatdata", appId);
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
