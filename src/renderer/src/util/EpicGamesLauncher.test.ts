import { QualifiedPath } from "@vortex/shared/filesystem";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { installInMemoryFS } from "../test-utils/fsApi";
import { EpicGamesLauncher, findEpicDataPath } from "./EpicGamesLauncher";

// registry keys mapped to the AppDataPath value they hold; any other key throws,
// as RegGetValue does for a key that doesn't exist
const registry = vi.hoisted(() => new Map<string, string>());

vi.mock("winapi-bindings", () => ({
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
