import * as fs from "node:fs/promises";
import * as path from "node:path";

import { parseStringPromise } from "xml2js";
import * as winapi from "winapi-bindings";

import { log } from "../../logging";
import type { IStoreGameEntry, IStoreScanner } from "../IStoreScanner";

const XBOXAPP_NAMES = ["microsoft.xboxapp", "microsoft.gamingapp"];

const IGNORABLE: string[] = [
  "microsoft.accounts", "microsoft.aad", "microsoft.advertising",
  "microsoft.bing", "microsoft.desktop", "microsoft.directx",
  "microsoft.gethelp", "microsoft.getstarted", "microsoft.hefi",
  "microsoft.lockapp", "microsoft.microsoft", "microsoft.net",
  "microsoft.office", "microsoft.oneconnect", "microsoft.services",
  "microsoft.ui", "microsoft.vclibs", "microsoft.windows",
  "microsoft.xbox", "microsoft.zune", "nvidiacorp", "realtek",
  "samsung", "synapticsincorporated", "windows", "dellinc",
  "microsoft.people", "ad2f1837",
];

const REPOSITORY_PATH =
  "Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\Repository\\Packages";
const REPOSITORY_PATH2 =
  "Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\PackageRepository\\Packages";
const MUTABLE_LOCATION_PATH =
  "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AppModel\\StateRepository\\Cache\\Package\\Data";
const RESOURCES_PATH =
  "Local Settings\\MrtCache\\C:%5CProgram Files%5CWindowsApps%5C{{PACKAGE_ID}}%5Cresources.pri";
const APP_MANIFEST = "appxmanifest.xml";

/**
 * Scans Xbox/Microsoft Store for installed games.
 *
 * Uses registry enumeration and XML manifest parsing.
 * Windows only.
 */
export class XboxScanner implements IStoreScanner {
  public readonly storeType = "xbox";

  public isAvailable(): Promise<boolean> {
    if (process.platform !== "win32") return Promise.resolve(false);
    return Promise.resolve(detectXboxInstalled());
  }

  public async scan(): Promise<IStoreGameEntry[]> {
    if (process.platform !== "win32") return [];
    if (!detectXboxInstalled()) return [];

    try {
      const gamePathMap = await findInstalledGames();
      return this.#getGameEntries(gamePathMap);
    } catch (err: unknown) {
      log("warn", "xbox-scanner: failed", { error: err instanceof Error ? err.message : String(err as string) });
      return [];
    }
  }

  #getGameEntries(
    gamePathMap: Record<string, string>,
  ): IStoreGameEntry[] {
    const mutableLinkMap = buildMutableLinkMap();
    const entries: IStoreGameEntry[] = [];

    try {
      winapi.WithRegOpen("HKEY_CLASSES_ROOT", REPOSITORY_PATH, (hkey) => {
        const keys = winapi.RegEnumKeys(hkey)
          .filter(
            (key) =>
              IGNORABLE.find((ign) =>
                key.key.toLowerCase().startsWith(ign),
              ) === undefined,
          )
          .map((key) => key.key);

        for (const key of keys) {
          try {
            const entry = this.#processKey(
              hkey,
              key,
              gamePathMap,
              mutableLinkMap,
            );
            if (entry) entries.push(entry);
          } catch (err: unknown) {
            log("debug", "xbox-scanner: failed to process key", {
              key,
              error: err instanceof Error ? err.message : String(err as string),
            });
          }
        }
      });
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }

    log("info", "xbox-scanner: completed", { count: entries.length });
    return entries;
  }

  #processKey(
    hkey: Buffer,
    key: string,
    gamePathMap: Record<string, string>,
    mutableLinkMap: Record<string, string>,
  ): IStoreGameEntry | undefined {
    const packageId = key;
    const publisherId = key.substring(key.lastIndexOf("_") + 1);
    const appid = key.substring(0, key.indexOf("_"));

    // Get execution name
    let executionName = "App";
    const firstKeyName = getFirstKeyName(
      "HKEY_CLASSES_ROOT",
      path.join(REPOSITORY_PATH2, key),
    );
    if (firstKeyName) {
      const split = firstKeyName.split("!");
      executionName = split.length > 1 ? split[split.length - 1] : "App";
    }

    // Get display name
    let displayName: string;
    try {
      displayName = winapi.RegGetValue(
        "HKEY_CLASSES_ROOT",
        REPOSITORY_PATH + "\\" + key,
        "DisplayName",
      ).value as string;
    } catch {
      return undefined;
    }

    const name = displayName.startsWith("@")
      ? resolveRef(packageId, displayName)
      : displayName;

    // Get game path
    let gamePath: string | undefined;
    try {
      gamePath = winapi.RegGetValue(hkey, key, "PackageRootFolder")
        .value as string;
    } catch {
      gamePath = gamePathMap[appid];
    }

    if (!gamePath) return undefined;

    // Prefer mutable location
    const mutableLocation =
      gamePathMap[appid] ?? resolveMutableLocation(gamePath, mutableLinkMap);
    if (mutableLocation) {
      gamePath = mutableLocation;
    }

    return {
      storeId: appid,
      installPath: gamePath,
      name: name ?? appid,
      metadata: {
        packageId,
        publisherId,
        executionName,
      },
    };
  }
}

// --- Helper functions ---

function detectXboxInstalled(): boolean {
  try {
    let found = false;
    winapi.WithRegOpen("HKEY_CLASSES_ROOT", REPOSITORY_PATH, (hkey) => {
      const keys = winapi.RegEnumKeys(hkey).map((k) => k.key.toLowerCase());
      found = keys.some(
        (key) => XBOXAPP_NAMES.some((name) => key.startsWith(name)),
      );
    });
    return found;
  } catch {
    return false;
  }
}

function getKeyNames(
  rootKey: winapi.REGISTRY_HIVE,
  keyPath: string,
  filterList?: string[],
): string[] {
  try {
    let result: string[] = [];
    winapi.WithRegOpen(rootKey, keyPath, (hkey) => {
      const names = winapi.RegEnumKeys(hkey);
      result = filterList
        ? names
            .filter(
              (key) =>
                !filterList.some((f) => key.key.toLowerCase().startsWith(f)),
            )
            .map((key) => key.key)
        : names.map((key) => key.key);
    });
    return result;
  } catch {
    return [];
  }
}

function getFirstKeyName(rootKey: winapi.REGISTRY_HIVE, keyPath: string): string | undefined {
  const names = getKeyNames(rootKey, keyPath);
  return names.length > 0 ? names[0] : undefined;
}

function resolveRef(
  packageId: string,
  displayName: string,
): string | undefined {
  const cachePath = RESOURCES_PATH.replace("{{PACKAGE_ID}}", packageId);
  const firstKey = getFirstKeyName("HKEY_CLASSES_ROOT", cachePath);
  if (!firstKey) return undefined;

  const hivesPath = path.join(cachePath, firstKey);
  const hives = getKeyNames("HKEY_CLASSES_ROOT", hivesPath);

  for (const hive of hives) {
    try {
      let name: string | undefined;
      const namePath = path.join(hivesPath, hive);
      winapi.WithRegOpen("HKEY_CLASSES_ROOT", namePath, (hk) => {
        const values = winapi.RegEnumValues(hk).map((v) => v.key);
        if (values.includes(displayName)) {
          name = winapi.RegGetValue(
            "HKEY_CLASSES_ROOT",
            namePath,
            displayName,
          ).value as string;
        }
      });
      if (name) return name;
    } catch {
      continue;
    }
  }

  return undefined;
}

function buildMutableLinkMap(): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    winapi.WithRegOpen("HKEY_LOCAL_MACHINE", MUTABLE_LOCATION_PATH, (hkey) => {
      const keys = winapi.RegEnumKeys(hkey).map((k) => k.key);
      for (const key of keys) {
        const hivePath = path.join(MUTABLE_LOCATION_PATH, key);
        try {
          winapi.WithRegOpen("HKEY_LOCAL_MACHINE", hivePath, (hk) => {
            const values = winapi.RegEnumValues(hk)
              .filter((v) => v.type === "REG_SZ")
              .map((v) => v.key);
            if (values.includes("MutableLink") && values.includes("MutableLocation")) {
              try {
                const link = winapi.RegGetValue(
                  "HKEY_LOCAL_MACHINE",
                  hivePath,
                  "MutableLink",
                ).value as string;
                result[link] = hivePath;
              } catch {
                // skip
              }
            }
          });
        } catch {
          // skip
        }
      }
    });
  } catch {
    // Mutable location path may not exist
  }
  return result;
}

function resolveMutableLocation(
  packagePath: string,
  linkMap: Record<string, string>,
): string | undefined {
  if (!linkMap[packagePath]) return undefined;
  try {
    return winapi.RegGetValue(
      "HKEY_LOCAL_MACHINE",
      linkMap[packagePath],
      "MutableLocation",
    ).value as string;
  } catch {
    return undefined;
  }
}

/**
 * Find installed Xbox games by scanning .GamingRoot files on all drives.
 * Simplified from the renderer version — doesn't need IExtensionApi.
 */
async function findInstalledGames(): Promise<Record<string, string>> {
  const gamePathMap: Record<string, string> = {};

  // Scan all drive letters A-Z
  for (let code = 65; code <= 90; code++) {
    const drive = `${String.fromCharCode(code)}:\\`;
    try {
      await fs.stat(drive);
    } catch {
      continue;
    }

    const gamingRootPath = await findXboxGamingRootPath(drive);
    if (!gamingRootPath) continue;

    try {
      const entries = await fs.readdir(gamingRootPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const manifestPath = path.join(
          gamingRootPath,
          entry.name,
          APP_MANIFEST,
        );
        try {
          const data = await fs.readFile(manifestPath, "utf8");
          const parsed = await parseStringPromise(data);
          const appId = parsed?.Package?.Identity?.[0]?.$?.Name;
          if (appId) {
            gamePathMap[appId] = path.join(gamingRootPath, entry.name);
          }
        } catch {
          // Not a valid game directory
        }
      }
    } catch {
      // Can't read gaming root
    }
  }

  return gamePathMap;
}

async function findXboxGamingRootPath(
  driveRoot: string,
): Promise<string | undefined> {
  const gamingRootFile = path.join(driveRoot, ".GamingRoot");
  try {
    const content = await fs.readFile(gamingRootFile);

    if (content.length % 2 !== 0 || content.length < 10) {
      return undefined;
    }

    // Parse UTF-16LE content after 8-byte header
    const chars: number[] = [];
    for (let i = 8; i < content.length; i += 2) {
      const value = content[i] | (content[i + 1] << 8);
      chars.push(value);
    }

    // Remove trailing null
    if (chars.length > 0 && chars[chars.length - 1] === 0) {
      chars.pop();
    }

    const relativePath = String.fromCharCode(...chars);
    const resultPath = path.join(driveRoot, relativePath);

    if (!path.isAbsolute(resultPath)) return undefined;

    try {
      await fs.stat(resultPath);
      return resultPath;
    } catch {
      return undefined;
    }
  } catch {
    return undefined;
  }
}
