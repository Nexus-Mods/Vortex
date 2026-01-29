import * as path from "path";
import * as Redux from "redux";
import { selectors, types, util } from "vortex-api";

interface IGameSupport {
  mygamesPath: string;
  iniName: string;
}

export const gameSupportXboxPass = {
  skyrimse: {
    mygamesPath: "Skyrim Special Edition MS",
  },
  fallout4: {
    mygamesPath: "Fallout4 MS",
  },
};

const gameSupport = util.makeOverlayableDictionary<string, IGameSupport>(
  {
    skyrim: {
      mygamesPath: "skyrim",
      iniName: "Skyrim.ini",
    },
    enderal: {
      mygamesPath: "enderal",
      iniName: "Enderal.ini",
    },
    skyrimse: {
      mygamesPath: "Skyrim Special Edition",
      iniName: "Skyrim.ini",
    },
    enderalspecialedition: {
      mygamesPath: "Enderal Special Edition",
      iniName: "Enderal.ini",
    },
    skyrimvr: {
      mygamesPath: "Skyrim VR",
      iniName: "SkyrimVR.ini",
    },
    fallout3: {
      mygamesPath: "Fallout3",
      iniName: "Fallout.ini",
    },
    fallout4: {
      mygamesPath: "Fallout4",
      iniName: "Fallout4.ini",
    },
    fallout4vr: {
      mygamesPath: "Fallout4VR",
      iniName: "Fallout4Custom.ini",
    },
    falloutnv: {
      mygamesPath: "FalloutNV",
      iniName: "Fallout.ini",
    },
    starfield: {
      mygamesPath: "Starfield",
      iniName: "StarfieldCustom.ini",
    },
    oblivion: {
      mygamesPath: "Oblivion",
      iniName: "Oblivion.ini",
    },
  },
  {
    xbox: gameSupportXboxPass,
    gog: {
      skyrimse: {
        mygamesPath: "Skyrim Special Edition GOG",
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
  return gameSupport.has(gameMode);
}

export function mygamesPath(gameMode: string): string {
  return path.join(
    util.getVortexPath("documents"),
    "My Games",
    gameSupport.get(gameMode, "mygamesPath"),
  );
}

export function iniPath(gameMode: string): string {
  return path.join(mygamesPath(gameMode), gameSupport.get(gameMode, "iniName"));
}
