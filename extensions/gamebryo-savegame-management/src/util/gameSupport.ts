import * as path from "path";
import * as Redux from "redux";
import { selectors, types, util } from "vortex-api";

interface IGameSupport {
  mygamesPath: string;
  iniName: string;
  prefIniName?: string;
  saveFiles: (input: string) => string[];
}

// Local interface for Steam entry fields we need (ISteamEntry extends IGameStoreEntry
// but is not exported by vortex-api; bundled extensions cannot import from renderer src)
interface ILocalSteamEntry {
  gamePath?: string;
  usesProton?: boolean;
  compatDataPath?: string;
}

function scriptExtenderFiles(input: string, seext: string): string[] {
  const ext = path.extname(input);
  return [path.basename(input, ext) + "." + seext];
}

const gameSupport = util.makeOverlayableDictionary<string, IGameSupport>(
  {
    skyrim: {
      mygamesPath: "skyrim",
      iniName: "Skyrim.ini",
      prefIniName: "SkyrimPrefs.ini",
      saveFiles: (input: string): string[] => {
        return [].concat([input], scriptExtenderFiles(input, "skse"));
      },
    },
    enderal: {
      mygamesPath: "enderal",
      iniName: "Enderal.ini",
      prefIniName: "EnderalPrefs.ini",
      saveFiles: (input: string): string[] =>
        [].concat([input], scriptExtenderFiles(input, "skse")),
    },
    skyrimse: {
      mygamesPath: "Skyrim Special Edition",
      iniName: "Skyrim.ini",
      prefIniName: "SkyrimPrefs.ini",
      saveFiles: (input: string): string[] => {
        return [].concat([input], scriptExtenderFiles(input, "skse"));
      },
    },
    skyrimvr: {
      mygamesPath: "Skyrim VR",
      iniName: "SkyrimVR.ini",
      prefIniName: "SkyrimPrefs.ini",
      saveFiles: (input: string): string[] => {
        return [].concat([input], scriptExtenderFiles(input, "skse"));
      },
    },
    fallout3: {
      mygamesPath: "Fallout3",
      iniName: "Fallout.ini",
      prefIniName: "FalloutPrefs.ini",
      saveFiles: (input: string): string[] => {
        return [].concat([input], scriptExtenderFiles(input, "fose"));
      },
    },
    fallout4: {
      mygamesPath: "Fallout4",
      iniName: "Fallout4Custom.ini",
      prefIniName: "Fallout4Prefs.ini",
      saveFiles: (input: string): string[] => {
        return [].concat([input], scriptExtenderFiles(input, "f4se"));
      },
    },
    fallout4vr: {
      mygamesPath: "Fallout4VR",
      iniName: "Fallout4Custom.ini",
      saveFiles: (input: string): string[] => {
        return [].concat([input], scriptExtenderFiles(input, "f4se"));
      },
    },
    falloutnv: {
      mygamesPath: "FalloutNV",
      iniName: "Fallout.ini",
      prefIniName: "FalloutPrefs.ini",
      saveFiles: (input: string): string[] => {
        return [].concat([input], scriptExtenderFiles(input, "nvse"));
      },
    },
    // starfield: {
    //   mygamesPath: 'Starfield',
    //   iniName: 'StarfieldCustom.ini',
    //   prefIniName: 'StarfieldPrefs.ini',
    //   saveFiles: (input: string): string[] => {
    //     return [].concat([input], scriptExtenderFiles(input, 'sfse'));
    //   },
    // },
    oblivion: {
      mygamesPath: "Oblivion",
      iniName: "Oblivion.ini",
      saveFiles: (input: string): string[] => {
        return [].concat([input], scriptExtenderFiles(input, "obse"));
      },
    },
    enderalspecialedition: {
      mygamesPath: "Enderal Special Edition",
      iniName: "Enderal.ini",
      prefIniName: "EnderalPrefs.ini",
      saveFiles: (input: string): string[] =>
        [].concat([input], scriptExtenderFiles(input, "skse")),
    },
  },
  {
    xbox: {
      skyrimse: {
        mygamesPath: "Skyrim Special Edition MS",
      },
      fallout4: {
        mygamesPath: "Fallout4 MS",
      },
      // starfield: {
      //   mygamesPath: path.join(util.getVortexPath('localAppData'), 'Packages', 'BethesdaSoftworks.Starfield_3275kfvn8vcwc', 'SystemAppData', 'wgs'),
      // }
    },
    gog: {
      skyrimse: {
        mygamesPath: "Skyrim Special Edition GOG",
      },
      enderalspecialedition: {
        mygamesPath: "Enderal Special Edition GOG",
      },
    },
    epic: {
      skyrimse: {
        mygamesPath: "Skyrim Special Edition EPIC",
      },
      fallout4: {
        mygamesPath: "Fallout4 EPIC",
      },
    },
    enderalseOverlay: {
      enderalspecialedition: {
        mygamesPath: "Skyrim Special Edition",
        iniName: "Skyrim.ini",
        prefIniName: "SkyrimPrefs.ini",
      },
    },
  },
  (gameId: string) => {
    const discovery = discoveryForGame(gameId);
    if (
      discovery?.path !== undefined &&
      gameId === "enderalspecialedition" &&
      discovery.path.includes("skyrim")
    ) {
      return "enderalseOverlay";
    } else {
      return discovery?.store;
    }
  },
);

let discoveryForGame: (gameId: string) => types.IDiscoveryResult = () =>
  undefined;

export function initGameSupport(api: types.IExtensionApi) {
  discoveryForGame = (gameId: string) =>
    selectors.discoveryByGame(api.store.getState(), gameId);
}

export function gameSupported(gameMode: string): boolean {
  return gameSupport[gameMode] !== undefined;
}

/**
 * Get the Steam store entry for a discovered game, if it uses Proton on Linux.
 * Mirrors the getSteamEntry pattern from ini_prep/index.ts.
 * Returns undefined when: not Linux, not a Steam game, or lookup fails.
 */
async function getSteamEntry(
  discovery: types.IDiscoveryResult,
): Promise<ILocalSteamEntry | undefined> {
  if (process.platform !== "linux" || discovery?.store !== "steam") {
    return undefined;
  }
  try {
    const steamStore = util.GameStoreHelper.getGameStore("steam");
    if (steamStore === undefined) {
      return undefined;
    }
    const entries: ILocalSteamEntry[] = await steamStore.allGames();
    return entries.find(
      (e) =>
        e.gamePath !== undefined &&
        discovery.path !== undefined &&
        e.gamePath.toLowerCase() === discovery.path.toLowerCase(),
    );
  } catch {
    return undefined;
  }
}

/**
 * Returns the My Games path for the given game mode.
 * On Linux with Proton games, returns the Wine prefix path inside compatdata.
 * On Windows and non-Proton Linux, returns the Documents/My Games path.
 */
export async function mygamesPath(gameMode: string): Promise<string> {
  if (process.platform === "linux") {
    const discovery = discoveryForGame(gameMode);
    if (discovery !== undefined) {
      const steamEntry = await getSteamEntry(discovery);
      if (steamEntry?.usesProton && steamEntry?.compatDataPath) {
        // Inline getMyGamesPath from src/renderer/src/util/linux/proton.ts
        // (bundled extensions cannot import from renderer src/)
        return path.join(
          steamEntry.compatDataPath,
          "pfx",
          "drive_c",
          "users",
          "steamuser",
          "Documents",
          "My Games",
          gameSupport.get(gameMode, "mygamesPath"),
        );
      }
    }
  }
  return path.join(
    util.getVortexPath("documents"),
    "My Games",
    gameSupport.get(gameMode, "mygamesPath"),
  );
}

export async function iniPath(gameMode: string): Promise<string> {
  return path.join(
    await mygamesPath(gameMode),
    gameSupport.get(gameMode, "iniName"),
  );
}

export async function prefIniPath(
  gameMode: string,
): Promise<string | undefined> {
  const prefIniName = gameSupport.get(gameMode, "prefIniName");
  if (prefIniName === undefined) {
    return undefined;
  }
  return path.join(await mygamesPath(gameMode), prefIniName);
}

export function saveFiles(gameMode: string, savePath: string): string[] {
  return gameSupport.get(gameMode, "saveFiles")(savePath);
}
