import * as fs from "node:fs/promises";
import * as path from "node:path";

import * as winapi from "winapi-bindings";

import { log } from "../../logging";

import type { IStoreGameEntry, IStoreScanner } from "../IStoreScanner";

const REG_EPIC_LAUNCHER =
  "SOFTWARE\\WOW6432Node\\Epic Games\\EpicGamesLauncher";
const ITEM_EXT = ".item";

export class EpicScanner implements IStoreScanner {
  public readonly storeType = "epic";

  public async isAvailable(): Promise<boolean> {
    if (process.platform !== "win32") {
      return false;
    }

    try {
      winapi.RegGetValue(
        "HKEY_LOCAL_MACHINE",
        REG_EPIC_LAUNCHER,
        "AppDataPath",
      );
      return true;
    } catch (err) {
      log("info", "Epic Games launcher not found", { error: String(err) });
      return false;
    }
  }

  public async scan(): Promise<IStoreGameEntry[]> {
    if (!(await this.isAvailable())) {
      return [];
    }

    let dataPath: string;
    try {
      dataPath = winapi.RegGetValue(
        "HKEY_LOCAL_MACHINE",
        REG_EPIC_LAUNCHER,
        "AppDataPath",
      ).value as string;
    } catch (err) {
      log("info", "Epic: could not read data path", { error: String(err) });
      return [];
    }

    const manifestsDir = path.join(dataPath, "Manifests");

    let files: string[];
    try {
      files = await fs.readdir(manifestsDir);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        log("info", "Epic: manifests directory not found", {
          path: manifestsDir,
        });
        return [];
      }
      throw err;
    }

    const manifests = files.filter((file) => file.endsWith(ITEM_EXT));
    const entries: IStoreGameEntry[] = [];

    for (const manifest of manifests) {
      try {
        const data = await fs.readFile(
          path.join(manifestsDir, manifest),
          "utf8",
        );
        const parsed = JSON.parse(data);

        const appName: string | undefined = parsed.AppName;
        const name: string | undefined = parsed.DisplayName;
        const gamePath: string | undefined = parsed.InstallLocation;
        const gameExec: string | undefined = parsed.LaunchExecutable;

        if (!appName || !name || !gamePath || !gameExec) {
          continue;
        }

        // Epic does not clean stale manifests; verify the executable exists.
        try {
          await fs.stat(path.join(gamePath, gameExec));
        } catch {
          continue;
        }

        entries.push({
          storeId: appName,
          installPath: gamePath,
          name,
        });
      } catch (err) {
        log("error", "Epic: failed to parse manifest", {
          manifest,
          error: String(err),
        });
      }
    }

    return entries;
  }
}
