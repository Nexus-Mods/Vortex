import path from "path";
import { selectors, types, util } from "vortex-api";

interface IDAGame {
  id: string;
  modPath: string;
  getAddinsFolder?: (api: types.IExtensionApi) => string;
}

// Dragon age game information.
export const DA_GAMES: { [gameName: string]: IDAGame } = {
  DragonAge1: {
    id: "dragonage",
    modPath: path.join(
      util.getVortexPath("documents"),
      "BioWare",
      "Dragon Age",
    ),
  },
  DragonAge2: {
    id: "dragonage2",
    modPath: path.join(
      util.getVortexPath("documents"),
      "BioWare",
      "Dragon Age 2" /*, 'packages', 'core', 'override'*/,
    ),
    getAddinsFolder: (api: types.IExtensionApi) => {
      const state = api.getState();
      const discovery = selectors.discoveryByGame(state, "dragonage2");
      return discovery?.path
        ? path.join(discovery.path, "addins")
        : path.join(
            util.getVortexPath("documents"),
            "BioWare",
            "Dragon Age 2" /*, 'packages', 'core', 'override'*/,
          );
    },
  },
};
