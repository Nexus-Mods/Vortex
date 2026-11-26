import * as path from "node:path";

import { parseError } from "@vortex/shared";
import { QualifiedPath } from "@vortex/shared/filesystem";
import * as winapi from "winapi-bindings";
import { z } from "zod";

import { log } from "../logging";
import type { IExtensionApi } from "../types/IExtensionContext";
import type { IGameStore, IGameStoreSnapshot } from "../types/IGameStore";
import { GameEntryNotFound } from "../types/IGameStore";
import type { IGameStoreEntry } from "../types/IGameStoreEntry";

const ITEM_EXT = "item";
const STORE_ID = "epic";
const STORE_NAME = "Epic Games Launcher";
const STORE_PRIORITY = 60;

// The current launcher installs as 64-bit and writes its key to the native registry
// view. Older installs were 32-bit, so their key was redirected under WOW6432Node.
const LAUNCHER_KEYS = [
  "SOFTWARE\\Epic Games\\EpicGamesLauncher",
  "SOFTWARE\\WOW6432Node\\Epic Games\\EpicGamesLauncher",
];

/** The launcher's data folder, holding the Manifests folder, or undefined when no
 * install is registered. */
export function findEpicDataPath(): string | undefined {
  let lastError: unknown;
  for (const key of LAUNCHER_KEYS) {
    try {
      const { value } = winapi.RegGetValue("HKEY_LOCAL_MACHINE", key, "AppDataPath");
      if (typeof value === "string") {
        return value;
      }
    } catch (err) {
      lastError = err;
    }
  }

  log("info", "Epic games launcher not found", lastError);
  return undefined;
}

/** The launcher's per-user settings file, which holds its per-game launch arguments. */
function findEpicSettingsPath(): string | undefined {
  const localAppData = process.env.LOCALAPPDATA;
  return localAppData
    ? path.join(
        localAppData,
        "EpicGamesLauncher",
        "Saved",
        "Config",
        "WindowsEditor",
        "GameUserSettings.ini",
      )
    : undefined;
}

function isLauncherRunning(): boolean {
  try {
    return winapi
      .GetProcessList()
      .some((proc) => proc.exeFile.toLowerCase() === "epicgameslauncher.exe");
  } catch (err) {
    log("warn", "failed to check whether the Epic Games Launcher is running", err);
    return false;
  }
}

/**
 * Adds `args` to a game's "Additional command line arguments" setting in the launcher's
 * GameUserSettings.ini and enables it. The setting is two keys in a per-account
 * `[<accountId>_Settings]` section:
 *   <gameKey>_AdditionalCommandsEnabled=True
 *   <gameKey>_AdditionalCommands=<args>
 * where gameKey is `<CatalogNamespace>:<CatalogItemId>:<AppName>`.
 *
 * The keys go into every `_Settings` section that already has a key for the game (the
 * launcher writes `<gameKey>_AutoUpdate` for the account that installed it), or into the only
 * `_Settings` section if none does. Arguments the user already set are kept; only the missing
 * ones are appended. Returns undefined if there is no section to write to.
 */
export function setLaunchArguments(
  ini: string,
  gameKey: string,
  args: string[],
): string | undefined {
  const eol = ini.includes("\r\n") ? "\r\n" : "\n";
  const lines = ini.split(/\r?\n/);

  const sections: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("[")) continue;
    if (sections.length > 0 && sections[sections.length - 1].end === -1) {
      sections[sections.length - 1].end = i;
    }
    if (/^\[\w+_Settings\]\s*$/.test(lines[i])) {
      sections.push({ start: i, end: -1 });
    }
  }
  for (const section of sections) {
    if (section.end === -1) section.end = lines.length;
  }

  const hasGameKey = (section: { start: number; end: number }) =>
    lines.slice(section.start + 1, section.end).some((line) => line.startsWith(`${gameKey}_`));
  let targets = sections.filter(hasGameKey);
  if (targets.length === 0 && sections.length === 1) {
    targets = sections;
  }
  if (targets.length === 0) {
    return undefined;
  }

  const enabledKey = `${gameKey}_AdditionalCommandsEnabled=`;
  const argsKey = `${gameKey}_AdditionalCommands=`;
  // last section first, so inserting lines doesn't shift the ranges still to be edited
  for (const { start, end } of [...targets].reverse()) {
    const findLine = (prefix: string) => {
      const idx = lines.slice(start + 1, end).findIndex((line) => line.startsWith(prefix));
      return idx === -1 ? -1 : start + 1 + idx;
    };
    const enabledIdx = findLine(enabledKey);
    const argsIdx = findLine(argsKey);

    // a disabled setting's old value is replaced rather than switched back on
    const enabled = enabledIdx !== -1 && lines[enabledIdx].slice(enabledKey.length) === "True";
    let value = enabled && argsIdx !== -1 ? lines[argsIdx].slice(argsKey.length).trim() : "";
    for (const arg of args) {
      if (!` ${value} `.includes(` ${arg} `)) {
        value = value.length > 0 ? `${value} ${arg}` : arg;
      }
    }

    if (argsIdx !== -1) {
      lines[argsIdx] = argsKey + value;
    }
    if (enabledIdx !== -1) {
      lines[enabledIdx] = enabledKey + "True";
    }
    // new keys go after the section's last entry, before the blank line that separates sections
    let insertAt = end;
    while (insertAt > start + 1 && lines[insertAt - 1].trim() === "") insertAt--;
    const added = [
      ...(enabledIdx === -1 ? [enabledKey + "True"] : []),
      ...(argsIdx === -1 ? [argsKey + value] : []),
    ];
    lines.splice(insertAt, 0, ...added);
  }

  return lines.join(eol);
}

/**
 * Epic Store launcher seems to be holding game information inside
 *  .item manifest files which are stored inside the launchers Data folder
 *  "(C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests" by default
 */
export class EpicGamesLauncher implements IGameStore {
  public id: string = STORE_ID;
  public name: string = STORE_NAME;
  public priority: number = STORE_PRIORITY;

  #dataPath: string | undefined;
  #settingsPath: string | undefined;
  #launcherExecPath: string | undefined;
  #snapshot: IGameStoreSnapshot;

  constructor(
    dataPath = process.platform === "win32" ? findEpicDataPath() : undefined,
    settingsPath = process.platform === "win32" ? findEpicSettingsPath() : undefined,
  ) {
    this.#dataPath = dataPath;
    this.#settingsPath = settingsPath;
    this.#snapshot = { entries: [], isInstalled: dataPath !== undefined };
  }

  public async launchGame(appInfo: any, api?: IExtensionApi): Promise<void> {
    const appId =
      typeof appInfo === "object" && "appId" in appInfo ? appInfo.appId : appInfo.toString();

    const parameters: unknown[] =
      typeof appInfo === "object" && Array.isArray(appInfo.parameters) ? appInfo.parameters : [];
    const args = parameters.filter(
      (arg): arg is string => typeof arg === "string" && arg.trim().length > 0,
    );
    if (args.length > 0) {
      await this.applyLaunchArguments(appId, args, api);
    }

    const posPath = await this.getPosixPath(appId);
    window.api.shell.openUrl(posPath);
  }

  public launchGameStore(api: IExtensionApi, parameters?: string[]): Promise<void> {
    const launchCommand = "com.epicgames.launcher://start";
    window.api.shell.openUrl(launchCommand);
    return Promise.resolve();
  }

  public getPosixPath(name: string): Promise<string> {
    return Promise.resolve(`com.epicgames.launcher://apps/${name}?action=launch&silent=true`);
  }

  public queryPath(): Promise<string> {
    return Promise.resolve(path.join(this.#dataPath, this.executable()));
  }

  /**
   * test if a game is installed through the launcher.
   * Please keep in mind that epic seems to internally give third-party games animal names. Kinky.
   * @param name
   */
  public async isGameInstalled(name: string): Promise<boolean> {
    try {
      await this.findByAppId(name);
      return true;
    } catch {
      try {
        await this.findByName(name);
        return true;
      } catch {
        return false;
      }
    }
  }

  public async findByAppId(appId: string | string[]): Promise<IGameStoreEntry> {
    const matcher = Array.isArray(appId)
      ? (entry: IGameStoreEntry) => appId.includes(entry.appid)
      : (entry: IGameStoreEntry) => appId === entry.appid;

    const entries = await this.allGames();
    const entry = entries.find(matcher);
    if (entry === undefined) {
      throw new GameEntryNotFound(Array.isArray(appId) ? appId.join(", ") : appId, STORE_ID);
    }

    return entry;
  }

  /**
   * Try to find the epic entry object using Epic's internal naming convention.
   *  e.g. "Flour" === "Untitled Goose Game" lol
   * @param name
   */
  public async findByName(name: string): Promise<IGameStoreEntry> {
    const re = new RegExp("^" + name + "$");
    const entries = await this.allGames();
    const entry = entries.find((entry) => re.test(entry.name));
    if (entry === undefined) {
      throw new GameEntryNotFound(name, STORE_ID);
    }
    return entry;
  }

  public allGames(): Promise<EpicGamesStoreEntry[]> {
    return Promise.resolve(this.#snapshot.entries as EpicGamesStoreEntry[]);
  }

  public snapshot(): IGameStoreSnapshot {
    return this.#snapshot;
  }

  public async reloadGames(): Promise<void> {
    const entries = await this.parseManifests();
    this.#snapshot = { entries, isInstalled: this.#snapshot.isInstalled };
  }

  public getGameStorePath(): Promise<string | undefined> {
    if (this.#launcherExecPath) {
      return Promise.resolve(this.#launcherExecPath);
    }

    try {
      const epicLauncher = winapi.RegGetValue(
        "HKEY_LOCAL_MACHINE",
        "SOFTWARE\\Classes\\com.epicgames.launcher\\DefaultIcon",
        "(Default)",
      );

      const val = epicLauncher.value;
      this.#launcherExecPath = val.toString().split(",")[0];
      return Promise.resolve(this.#launcherExecPath);
    } catch (err) {
      log("info", "Epic games launcher not found", err);
      return Promise.resolve(undefined);
    }
  }

  /**
   * The launch URI has no slot for arguments, so they go into the launcher's own per-game
   * "Additional command line arguments" setting, which it adds when it starts the game.
   * The launcher reads that setting only when it starts and writes it back from memory while
   * running, so this only works while the launcher is closed. Never throws: on any problem the
   * game is launched without the arguments.
   */
  private async applyLaunchArguments(
    appId: string,
    args: string[],
    api?: IExtensionApi,
  ): Promise<void> {
    if (this.#settingsPath === undefined) {
      return;
    }

    if (isLauncherRunning()) {
      log("info", "Epic Games Launcher is running, launching without arguments", { appId, args });
      api?.sendNotification?.({
        id: "epic-launch-arguments-skipped",
        type: "info",
        message:
          "The Epic Games Launcher was already running, so the game started without the " +
          "launch arguments its extension asks for. Exit the Epic Games Launcher before " +
          "starting the game from Vortex to apply them.",
        displayMS: 10000,
      });
      return;
    }

    try {
      const entry = (await this.findByAppId(appId)) as EpicGamesStoreEntry;
      const gameKey = `${entry.catalogNamespace}:${entry.catalogItemId}:${entry.appid}`;
      const settingsFile = QualifiedPath.fromNative(this.#settingsPath);
      const ini = new TextDecoder().decode(await window.api.fs.readFile(settingsFile));
      const updated = setLaunchArguments(ini, gameKey, args);
      if (updated === undefined) {
        log(
          "warn",
          "no Epic Games Launcher settings section for game, launching without arguments",
          {
            appId,
          },
        );
      } else if (updated !== ini) {
        await window.api.fs.writeFile(settingsFile, new TextEncoder().encode(updated));
      }
    } catch (err) {
      log("warn", "failed to set Epic launch arguments, launching without them", {
        appId,
        error: parseError(err).message,
      });
    }
  }

  private executable() {
    // TODO: This probably won't work on *nix, test and fix.
    return process.platform === "win32" ? "EpicGamesLauncher.exe" : "EpicGamesLauncher";
  }

  private async parseManifests(): Promise<EpicGamesStoreEntry[]> {
    try {
      if (this.#dataPath === undefined) return [];

      const manifestsLocation = QualifiedPath.fromNative(this.#dataPath).join("Manifests");

      let iterator: AsyncIterableIterator<QualifiedPath, undefined>;

      try {
        iterator = await window.api.fs.enumerateDirectory(manifestsLocation);
      } catch (err) {
        if (parseError(err).data.kind === "fs:not-found") {
          log("info", "Epic launcher manifests could not be found");
          return [];
        }

        throw err;
      }

      const games: EpicGamesStoreEntry[] = [];
      for await (const entry of iterator) {
        if (entry.extension !== ITEM_EXT) continue;

        let data: string;
        try {
          const blob = await window.api.fs.readFile(entry);
          data = new TextDecoder().decode(blob);
        } catch (err) {
          log("error", "Cannot read EGS manifest", { err, entry });
          continue;
        }

        try {
          const result = manifestSchema.safeParse(JSON.parse(data));
          if (result.error) {
            log("warn", "Failed to parse EGS manifest", { entry, error: result.error });
            continue;
          }

          const parsed = result.data;

          // Epic does not seem to clean old manifests. We need
          //  to stat the executable for each item to ensure that the
          //  game entry is actually valid.
          try {
            const status = await window.api.fs.stat(
              QualifiedPath.fromNative(parsed.InstallLocation).join(parsed.LaunchExecutable),
            );
            if (!status.exists) continue;
          } catch {
            continue;
          }

          const storeEntry: EpicGamesStoreEntry = {
            gameStoreId: STORE_ID,
            name: parsed.DisplayName,
            appid: parsed.AppName,
            catalogItemId: parsed.CatalogItemId,
            catalogNamespace: parsed.CatalogNamespace,
            gamePath: parsed.InstallLocation,
          };

          games.push(storeEntry);
        } catch (err) {
          log("error", "Cannot parse Epic Games manifest", { err, entry });
          continue;
        }
      }

      return games;
    } catch (err) {
      log("error", "Failed to parse Epic Games manifests", err);
      return [];
    }
  }
}

export interface EpicGamesStoreEntry extends IGameStoreEntry {
  catalogItemId: string;
  catalogNamespace: string;
}

const manifestSchema = z.looseObject({
  LaunchExecutable: z.string(),
  InstallLocation: z.string(),
  DisplayName: z.string(),
  AppName: z.string(),
  CatalogItemId: z.string(),
  CatalogNamespace: z.string(),
});

const instance: IGameStore | undefined =
  process.platform === "win32" ? new EpicGamesLauncher() : undefined;

export default instance;
