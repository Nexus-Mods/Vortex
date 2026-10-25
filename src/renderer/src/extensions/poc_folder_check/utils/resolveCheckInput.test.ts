import { describe, expect, it } from "vitest";

import type { ISteamEntry } from "@/util/Steam";

import { resolveCheckInput } from "./resolveCheckInput";

const CYBERPUNK_PATH = "D:\\SteamLibrary\\steamapps\\common\\Cyberpunk 2077";
const STEAM_EXE = "C:\\Program Files (x86)\\Steam\\steam.exe";

const cyberpunk: ISteamEntry = {
  appid: "1091500",
  name: "Cyberpunk 2077",
  gamePath: CYBERPUNK_PATH,
  gameStoreId: "steam",
  installData: {
    appId: 1091500,
    buildId: 26133166,
    stateFlags: 4,
    targetBuildId: 26133166,
    branch: null,
    language: "english",
    mountedLanguage: "english",
    depots: [
      { depotId: 1091501, manifestId: "2461377369266892508", dlcAppId: null },
      { depotId: 2138330, manifestId: "8416081049196797989", dlcAppId: "2138330" },
    ],
    sharedDepots: [{ depotId: 228988, ownerAppId: 228980 }],
  },
};

describe("resolveCheckInput", () => {
  it("builds input from the Steam entry matched by app id", () => {
    const result = resolveCheckInput({
      discoveryPath: "E:\\Elsewhere",
      steamAppId: 1091500,
      steamEntries: [cyberpunk],
      steamExePath: STEAM_EXE,
    });
    expect(result).toEqual({
      ok: true,
      discoveryPath: "E:\\Elsewhere",
      input: {
        appId: 1091500,
        buildId: 26133166,
        steamPath: "C:\\Program Files (x86)\\Steam",
        gamePath: CYBERPUNK_PATH,
        depots: [
          { depotId: 1091501, manifestId: "2461377369266892508" },
          { depotId: 2138330, manifestId: "8416081049196797989" },
        ],
      },
    });
  });

  it("falls back to the discovery path", () => {
    const result = resolveCheckInput({
      discoveryPath: "d:/steamlibrary/steamapps/common/cyberpunk 2077/",
      steamAppId: undefined,
      steamEntries: [cyberpunk],
      steamExePath: STEAM_EXE,
    });
    expect(result.ok).toBe(true);
  });

  it("says so when the game isn't from Steam", () => {
    expect(
      resolveCheckInput({
        discoveryPath: "C:\\GOG Games\\Cyberpunk 2077",
        steamAppId: undefined,
        steamEntries: [cyberpunk],
        steamExePath: STEAM_EXE,
      }),
    ).toEqual({ ok: false, reason: "This check only works for Steam games so far." });
  });

  it("says so when installData is missing", () => {
    expect(
      resolveCheckInput({
        discoveryPath: CYBERPUNK_PATH,
        steamAppId: 1091500,
        steamEntries: [{ ...cyberpunk, installData: undefined }],
        steamExePath: STEAM_EXE,
      }),
    ).toEqual({ ok: false, reason: "Steam's install details for this game couldn't be read." });
  });

  it("says so when Steam isn't found", () => {
    expect(
      resolveCheckInput({
        discoveryPath: CYBERPUNK_PATH,
        steamAppId: 1091500,
        steamEntries: [cyberpunk],
        steamExePath: undefined,
      }),
    ).toEqual({ ok: false, reason: "Vortex couldn't find the Steam install." });
  });
});
