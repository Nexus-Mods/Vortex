import { QualifiedPath } from "@vortex/shared/filesystem";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { installInMemoryFS } from "../test-utils/fsApi";
import type { IExtensionApi } from "../types/IExtensionContext";
import { EpicGamesLauncher, findEpicDataPath, setLaunchArguments } from "./EpicGamesLauncher";

// registry keys mapped to the AppDataPath value they hold; any other key throws,
// as RegGetValue does for a key that doesn't exist
const registry = vi.hoisted(() => new Map<string, string>());
// exe names GetProcessList reports as running
const processes = vi.hoisted(() => [] as string[]);

vi.mock("winapi-bindings", () => ({
  GetProcessList: () => processes.map((exeFile) => ({ exeFile })),
  RegGetValue: (_hive: string, key: string, _value: string) => {
    const value = registry.get(key);
    if (value === undefined) {
      throw new Error("The system cannot find the file specified.");
    }
    return { type: "REG_SZ", value };
  },
}));

const KEY_64 = "SOFTWARE\\Epic Games\\EpicGamesLauncher";
const KEY_32 = "SOFTWARE\\WOW6432Node\\Epic Games\\EpicGamesLauncher";

describe("findEpicDataPath", () => {
  beforeEach(() => {
    registry.clear();
  });

  it("reads the 64-bit key a current launcher install writes", () => {
    registry.set(KEY_64, "C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\");

    expect(findEpicDataPath()).toBe("C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\");
  });

  it("falls back to the 32-bit key an older launcher install wrote", () => {
    registry.set(KEY_32, "D:\\Epic\\Data\\");

    expect(findEpicDataPath()).toBe("D:\\Epic\\Data\\");
  });

  it("is undefined when the launcher isn't installed", () => {
    expect(findEpicDataPath()).toBeUndefined();
  });
});

const DATA_PATH = "C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data";

function manifest(name: string, installLocation: string): string {
  return JSON.stringify({
    FormatVersion: 0,
    DisplayName: name,
    AppName: `${name}App`,
    CatalogNamespace: `${name}-namespace`,
    CatalogItemId: `${name}-item`,
    InstallLocation: installLocation,
    LaunchExecutable: "Game.exe",
  });
}

/** Seeds the launcher's Manifests folder with one .item file per manifest, plus the
 * launch executable of each install listed in `installed`. */
async function scan(manifests: Record<string, string>, installed: string[]) {
  const { restore } = installInMemoryFS((builder) => {
    const folder = QualifiedPath.fromNative(DATA_PATH).join("Manifests");
    for (const [file, data] of Object.entries(manifests)) {
      builder.file(folder.join(file), { type: "text", data });
    }
    for (const location of installed) {
      builder.file(QualifiedPath.fromNative(location).join("Game.exe"), {
        type: "text",
        data: "",
      });
    }
  });

  try {
    const store = new EpicGamesLauncher(DATA_PATH);
    await store.reloadGames();
    return store.allGames();
  } finally {
    restore();
  }
}

describe("EpicGamesLauncher.reloadGames", () => {
  it("lists installed games from their .item manifests", async () => {
    const games = await scan({ "A.item": manifest("Abzu", "C:\\Games\\Abzu") }, [
      "C:\\Games\\Abzu",
    ]);

    expect(games).toEqual([
      {
        gameStoreId: "epic",
        name: "Abzu",
        appid: "AbzuApp",
        catalogNamespace: "Abzu-namespace",
        catalogItemId: "Abzu-item",
        gamePath: "C:\\Games\\Abzu",
      },
    ]);
  });

  it("skips manifests whose executable is gone, and ones that aren't valid JSON", async () => {
    const games = await scan(
      {
        "A.item": manifest("Abzu", "C:\\Games\\Abzu"),
        "B.item": manifest("Removed", "C:\\Games\\Removed"),
        "C.item": "{ not json",
      },
      ["C:\\Games\\Abzu"],
    );

    expect(games.map((game) => game.name)).toEqual(["Abzu"]);
  });
});

const GAME_KEY = "Abzu-namespace:Abzu-item:AbzuApp";
const ME = "0123456789abcdef0123456789abcdef";
const OTHER = "fedcba9876543210fedcba9876543210";

/** A GameUserSettings.ini shaped like the launcher's: CRLF, blank line between sections. */
const settingsIni = (...sections: string[][]): string =>
  sections.map((lines) => lines.join("\r\n")).join("\r\n\r\n") + "\r\n";

describe("setLaunchArguments", () => {
  it("adds both keys to the section that has the game, keeping CRLF and the blank line", () => {
    const ini = settingsIni(
      ["[Launcher]", "LastActiveVersion=1"],
      [`[${OTHER}_Settings]`, "fn:x:Fortnite_AutoUpdate=True"],
      [`[${ME}_Settings]`, `${GAME_KEY}_AutoUpdate=True`],
      [`[${ME}_Launcher]`, "LastPlayedGame=x"],
    );

    expect(setLaunchArguments(ini, GAME_KEY, ["-offline"])).toBe(
      settingsIni(
        ["[Launcher]", "LastActiveVersion=1"],
        [`[${OTHER}_Settings]`, "fn:x:Fortnite_AutoUpdate=True"],
        [
          `[${ME}_Settings]`,
          `${GAME_KEY}_AutoUpdate=True`,
          `${GAME_KEY}_AdditionalCommandsEnabled=True`,
          `${GAME_KEY}_AdditionalCommands=-offline`,
        ],
        [`[${ME}_Launcher]`, "LastPlayedGame=x"],
      ),
    );
  });

  it("uses the only settings section when none has the game yet", () => {
    const ini = settingsIni([`[${ME}_Settings]`, "Allow_RetryCanceledUpdates=False"]);

    expect(setLaunchArguments(ini, GAME_KEY, ["-offline"])).toContain(
      `Allow_RetryCanceledUpdates=False\r\n${GAME_KEY}_AdditionalCommandsEnabled=True\r\n` +
        `${GAME_KEY}_AdditionalCommands=-offline\r\n`,
    );
  });

  it("gives up when several accounts exist and none has the game", () => {
    const ini = settingsIni([`[${ME}_Settings]`], [`[${OTHER}_Settings]`]);

    expect(setLaunchArguments(ini, GAME_KEY, ["-offline"])).toBeUndefined();
  });

  it("keeps the user's own enabled arguments and adds only the missing ones", () => {
    const ini = settingsIni([
      `[${ME}_Settings]`,
      `${GAME_KEY}_AdditionalCommandsEnabled=True`,
      `${GAME_KEY}_AdditionalCommands=-windowed -offline`,
    ]);

    const once = setLaunchArguments(ini, GAME_KEY, ["-offline", "+set fov 90"]);
    expect(once).toContain(`${GAME_KEY}_AdditionalCommands=-windowed -offline +set fov 90\r\n`);
    // launching again doesn't add them a second time
    expect(setLaunchArguments(once!, GAME_KEY, ["-offline", "+set fov 90"])).toBe(once);
  });

  it("replaces a disabled setting's value and enables it", () => {
    const ini = settingsIni([
      `[${ME}_Settings]`,
      `${GAME_KEY}_AdditionalCommandsEnabled=False`,
      `${GAME_KEY}_AdditionalCommands=-old`,
    ]);

    expect(setLaunchArguments(ini, GAME_KEY, ["-offline"])).toBe(
      settingsIni([
        `[${ME}_Settings]`,
        `${GAME_KEY}_AdditionalCommandsEnabled=True`,
        `${GAME_KEY}_AdditionalCommands=-offline`,
      ]),
    );
  });
});

describe("EpicGamesLauncher.launchGame", () => {
  const SETTINGS_PATH = "C:\\Users\\Me\\AppData\\Local\\EpicGamesLauncher\\GameUserSettings.ini";
  const INI = settingsIni([`[${ME}_Settings]`, `${GAME_KEY}_AutoUpdate=True`]);
  const URI = "com.epicgames.launcher://apps/AbzuApp?action=launch&silent=true";

  let openUrl: ReturnType<typeof vi.fn>;
  let sendNotification: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    processes.length = 0;
    openUrl = vi.fn();
    sendNotification = vi.fn();
  });

  /** Launches Abzu with `appInfo` and returns the settings file afterwards (undefined if
   * it doesn't exist). */
  async function launch(appInfo: unknown, ini: string | undefined = INI) {
    const settingsFile = QualifiedPath.fromNative(SETTINGS_PATH);
    const { restore } = installInMemoryFS((builder) => {
      builder.file(QualifiedPath.fromNative(DATA_PATH).join("Manifests").join("A.item"), {
        type: "text",
        data: manifest("Abzu", "C:\\Games\\Abzu"),
      });
      builder.file(QualifiedPath.fromNative("C:\\Games\\Abzu").join("Game.exe"), {
        type: "text",
        data: "",
      });
      if (ini !== undefined) {
        builder.file(settingsFile, { type: "text", data: ini });
      }
    });
    const previousShell = window.api.shell;
    window.api.shell = { ...previousShell, openUrl } as typeof window.api.shell;

    try {
      const store = new EpicGamesLauncher(DATA_PATH, SETTINGS_PATH);
      await store.reloadGames();
      await store.launchGame(appInfo, { sendNotification } as unknown as IExtensionApi);
      return ini === undefined
        ? undefined
        : new TextDecoder().decode(await window.api.fs.readFile(settingsFile));
    } finally {
      window.api.shell = previousShell;
      restore();
    }
  }

  it("leaves the settings file alone when there are no arguments", async () => {
    expect(await launch({ appId: "AbzuApp" })).toBe(INI);
    expect(await launch({ appId: "AbzuApp", parameters: ["", "  "] })).toBe(INI);
    expect(openUrl).toHaveBeenCalledWith(URI);
  });

  it("writes the arguments into the launcher's setting before opening the launch URI", async () => {
    const ini = await launch({ appId: "AbzuApp", parameters: ["-offline", "-skipintro"] });

    expect(ini).toContain(`${GAME_KEY}_AdditionalCommandsEnabled=True\r\n`);
    expect(ini).toContain(`${GAME_KEY}_AdditionalCommands=-offline -skipintro\r\n`);
    expect(openUrl).toHaveBeenCalledWith(URI);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("skips the write and tells the user when the launcher is already running", async () => {
    processes.push("EpicGamesLauncher.exe");

    expect(await launch({ appId: "AbzuApp", parameters: ["-offline"] })).toBe(INI);
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: "epic-launch-arguments-skipped", type: "info" }),
    );
    expect(openUrl).toHaveBeenCalledWith(URI);
  });

  it("still launches when the settings file doesn't exist", async () => {
    await launch({ appId: "AbzuApp", parameters: ["-offline"] }, undefined);

    expect(openUrl).toHaveBeenCalledWith(URI);
  });
});
