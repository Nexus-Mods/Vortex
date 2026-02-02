import * as path from "path";
import * as Redux from "redux";
import { selectors, types, util } from "vortex-api";

interface IGameSupport {
  settingsPath?: () => string;
  appDataPath?: () => string;
}

const localAppData: () => string = (() => {
  let cached: string;
  return () => {
    if (cached === undefined) {
      cached =
        process.env.LOCALAPPDATA ||
        path.resolve(util.getVortexPath("appData"), "..", "Local");
    }
    return cached;
  };
})();

const gameSupport = util.makeOverlayableDictionary<string, IGameSupport>(
  {
    fallout3: {
      settingsPath: () =>
        path.join(util.getVortexPath("documents"), "My Games", "Fallout3"),
      appDataPath: () => path.join(localAppData(), "Fallout3"),
    },
    falloutnv: {
      settingsPath: () =>
        path.join(util.getVortexPath("documents"), "My Games", "FalloutNV"),
      appDataPath: () => path.join(localAppData(), "FalloutNV"),
    },
    fallout4: {
      settingsPath: () =>
        path.join(util.getVortexPath("documents"), "My Games", "Fallout4"),
      appDataPath: () => path.join(localAppData(), "Fallout4"),
    },
    fallout4vr: {
      settingsPath: () =>
        path.join(util.getVortexPath("documents"), "My Games", "Fallout4VR"),
      appDataPath: () => path.join(localAppData(), "Fallout4VR"),
    },
    starfield: {
      settingsPath: () =>
        path.join(util.getVortexPath("documents"), "My Games", "Starfield"),
      appDataPath: () => path.join(localAppData(), "Starfield"),
    },
    oblivion: {
      settingsPath: () =>
        path.join(util.getVortexPath("documents"), "My Games", "Oblivion"),
      appDataPath: () => path.join(localAppData(), "Oblivion"),
    },
    skyrim: {
      settingsPath: () =>
        path.join(util.getVortexPath("documents"), "My Games", "Skyrim"),
      appDataPath: () => path.join(localAppData(), "Skyrim"),
    },
    skyrimse: {
      settingsPath: () =>
        path.join(
          util.getVortexPath("documents"),
          "My Games",
          "Skyrim Special Edition",
        ),
      appDataPath: () => path.join(localAppData(), "Skyrim Special Edition"),
    },
    skyrimvr: {
      settingsPath: () =>
        path.join(util.getVortexPath("documents"), "My Games", "SkyrimVR"),
      appDataPath: () => path.join(localAppData(), "SkyrimVR"),
    },
  },
  {
    xbox: {
      skyrimse: {
        settingsPath: () =>
          path.join(
            util.getVortexPath("documents"),
            "My Games",
            "Skyrim Special Edition MS",
          ),
        appDataPath: () =>
          path.join(localAppData(), "Skyrim Special Edition MS"),
      },
      fallout4: {
        settingsPath: () =>
          path.join(util.getVortexPath("documents"), "My Games", "Fallout4 MS"),
        appDataPath: () => path.join(localAppData(), "Fallout4 MS"),
      },
    },
    gog: {
      skyrimse: {
        settingsPath: () =>
          path.join(
            util.getVortexPath("documents"),
            "My Games",
            "Skyrim Special Edition GOG",
          ),
        appDataPath: () =>
          path.join(localAppData(), "Skyrim Special Edition GOG"),
      },
      enderalspecialedition: {
        settingsPath: () =>
          path.join(
            util.getVortexPath("documents"),
            "My Games",
            "Enderal Special Edition GOG",
          ),
        appDataPath: () =>
          path.join(localAppData(), "Enderal Special Edition GOG"),
      },
    },
    epic: {
      skyrimse: {
        settingsPath: () =>
          path.join(
            util.getVortexPath("documents"),
            "My Games",
            "Skyrim Special Edition EPIC",
          ),
        appDataPath: () =>
          path.join(localAppData(), "Skyrim Special Edition EPIC"),
      },
      fallout4: {
        settingsPath: () =>
          path.join(
            util.getVortexPath("documents"),
            "My Games",
            "Fallout4 EPIC",
          ),
        appDataPath: () => path.join(localAppData(), "Fallout4 EPIC"),
      },
    },
  },
  (gameId) => gameStoreForGame(gameId),
);

let gameStoreForGame: (gameId: string) => string = () => undefined;

export function initGameSupport(api: types.IExtensionApi) {
  gameStoreForGame = (gameId: string) =>
    selectors.discoveryByGame(api.store.getState(), gameId)?.store;
}

export function settingsPath(game: types.IGame): string {
  return (
    gameSupport.get(game.id, "settingsPath")?.() ??
    game.details?.settingsPath?.()
  );
}

export function appDataPath(game: types.IGame): string {
  return (
    gameSupport.get(game.id, "appDataPath")?.() ?? game.details?.appDataPath?.()
  );
}
