import * as path from "path";

import { selectors, types, util } from "@nexusmods/vortex-api";
import * as Redux from "redux";

interface IGameSupport {
  settingsPath?: (documents: string) => string;
  appDataPath?: (localAppData: string) => string;
}

const gameSupport = util.makeOverlayableDictionary<string, IGameSupport>(
  {
    fallout3: {
      settingsPath: (documents) => path.join(documents, "My Games", "Fallout3"),
      appDataPath: (localAppData) => path.join(localAppData, "Fallout3"),
    },
    falloutnv: {
      settingsPath: (documents) => path.join(documents, "My Games", "FalloutNV"),
      appDataPath: (localAppData) => path.join(localAppData, "FalloutNV"),
    },
    fallout4: {
      settingsPath: (documents) => path.join(documents, "My Games", "Fallout4"),
      appDataPath: (localAppData) => path.join(localAppData, "Fallout4"),
    },
    fallout4vr: {
      settingsPath: (documents) => path.join(documents, "My Games", "Fallout4VR"),
      appDataPath: (localAppData) => path.join(localAppData, "Fallout4VR"),
    },
    starfield: {
      settingsPath: (documents) => path.join(documents, "My Games", "Starfield"),
      appDataPath: (localAppData) => path.join(localAppData, "Starfield"),
    },
    oblivion: {
      settingsPath: (documents) => path.join(documents, "My Games", "Oblivion"),
      appDataPath: (localAppData) => path.join(localAppData, "Oblivion"),
    },
    skyrim: {
      settingsPath: (documents) => path.join(documents, "My Games", "Skyrim"),
      appDataPath: (localAppData) => path.join(localAppData, "Skyrim"),
    },
    skyrimse: {
      settingsPath: (documents) => path.join(documents, "My Games", "Skyrim Special Edition"),
      appDataPath: (localAppData) => path.join(localAppData, "Skyrim Special Edition"),
    },
    skyrimvr: {
      settingsPath: (documents) => path.join(documents, "My Games", "SkyrimVR"),
      appDataPath: (localAppData) => path.join(localAppData, "SkyrimVR"),
    },
  },
  {
    xbox: {
      skyrimse: {
        settingsPath: (documents) => path.join(documents, "My Games", "Skyrim Special Edition MS"),
        appDataPath: (localAppData) => path.join(localAppData, "Skyrim Special Edition MS"),
      },
      fallout4: {
        settingsPath: (documents) => path.join(documents, "My Games", "Fallout4 MS"),
        appDataPath: (localAppData) => path.join(localAppData, "Fallout4 MS"),
      },
    },
    gog: {
      skyrimse: {
        settingsPath: (documents) => path.join(documents, "My Games", "Skyrim Special Edition GOG"),
        appDataPath: (localAppData) => path.join(localAppData, "Skyrim Special Edition GOG"),
      },
      enderalspecialedition: {
        settingsPath: (documents) =>
          path.join(documents, "My Games", "Enderal Special Edition GOG"),
        appDataPath: (localAppData) => path.join(localAppData, "Enderal Special Edition GOG"),
      },
    },
    epic: {
      skyrimse: {
        settingsPath: (documents) =>
          path.join(documents, "My Games", "Skyrim Special Edition EPIC"),
        appDataPath: (localAppData) => path.join(localAppData, "Skyrim Special Edition EPIC"),
      },
      fallout4: {
        settingsPath: (documents) => path.join(documents, "My Games", "Fallout4 EPIC"),
        appDataPath: (localAppData) => path.join(localAppData, "Fallout4 EPIC"),
      },
    },
  },
  (gameId) => gameStoreForGame(gameId),
);

let discoveryForGame: (gameId: string) => types.IDiscoveryResult = () => undefined;
const gameStoreForGame = (gameId: string) => discoveryForGame(gameId)?.store;

export function initGameSupport(api: types.IExtensionApi) {
  discoveryForGame = (gameId: string) => selectors.discoveryByGame(api.store.getState(), gameId);
}

export function settingsPath(game: types.IGame): string {
  const documents = util.windowsUserPath("documents", game.id, discoveryForGame(game.id));
  return gameSupport.get(game.id, "settingsPath")?.(documents) ?? game.details?.settingsPath?.();
}

export function appDataPath(game: types.IGame): string {
  const localAppData = util.windowsUserPath("localAppData", game.id, discoveryForGame(game.id));
  return gameSupport.get(game.id, "appDataPath")?.(localAppData) ?? game.details?.appDataPath?.();
}
