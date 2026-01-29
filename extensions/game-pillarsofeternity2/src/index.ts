import LoadOrder from "./views/LoadOrder";

import { getLoadOrder, setLoadOrder, startWatch, stopWatch } from "./sync";
import { ILoadOrder } from "./types";

import Promise from "bluebird";
import * as path from "path";
import { fs, log, selectors, types, util } from "vortex-api";

const poe2LocalLowPath = path.resolve(
  util.getVortexPath("appData"),
  "..",
  "LocalLow",
  "Obsidian Entertainment",
  "Pillars of Eternity II",
);

const tools = [];

const MODIFIABLE_WIN_APPS = "modifiablewindowsapps";
const MS_ID = "VersusEvil.PillarsofEternity2-PC";
const STEAM_ID = "560130";

function genAttributeExtractor(api: types.IExtensionApi) {
  // tslint:disable-next-line:no-shadowed-variable
  return (modInfo: any, modPath: string): Promise<{ [key: string]: any }> => {
    const gameMode = selectors.activeGameId(api.store.getState());
    if (modPath === undefined || gameMode !== "pillarsofeternity2") {
      return Promise.resolve({});
    }
    return fs
      .readFileAsync(path.join(modPath, "manifest.json"), { encoding: "utf-8" })
      .catch(() => "{}")
      .then((jsonData) => {
        try {
          const data = JSON.parse((util as any).deBOM(jsonData));
          const res: { [key: string]: any } = {
            // is this case insensitive?
            minGameVersion: (util as any).getSafeCI(
              data,
              ["SupportedGameVersion", "min"],
              "1.0",
            ),
            maxGameVersion: (util as any).getSafeCI(
              data,
              ["SupportedGameVersion", "max"],
              "9.0",
            ),
          };
          return res;
        } catch (err) {
          log("warn", "Invalid manifest.json", { modPath });
          return {};
        }
      });
  };
}

function findGame(): Promise<string> {
  return util.GameStoreHelper.findByAppId([STEAM_ID, MS_ID])
    .catch((err) =>
      (util.steam as any).findByName("Pillars of Eternity II: Deadfire"),
    )
    .then((game) => game.gamePath);
}

function modPath(discoveryPath: string): string {
  return discoveryPath.includes("ModifiableWindowsApps")
    ? path.join("PillarsOfEternity2_Data", "override")
    : path.join("PillarsOfEternityII_Data", "override");
}

function modConfig(): string {
  return path.join(poe2LocalLowPath, "modconfig.json");
}

function prepareForModding(discovery: types.IDiscoveryResult): Promise<void> {
  return createModConfigFile().then(() =>
    fs.ensureDirWritableAsync(
      path.join(discovery.path, modPath(discovery.path)),
    ),
  );
}

function createModConfigFile(): Promise<void> {
  return fs
    .statAsync(modConfig())
    .then((st) => Promise.resolve())
    .catch((err) => {
      if ((err as any).code === "ENOENT") {
        return writeModConfigFile();
      } else {
        return Promise.reject(err);
      }
    });
}

function executable(discoveryPath: string) {
  if (discoveryPath === undefined) {
    return "PillarsOfEternityII.exe";
  } else {
    return discoveryPath.toLowerCase().includes(MODIFIABLE_WIN_APPS)
      ? "PillarsOfEternity2.exe"
      : "PillarsOfEternityII.exe";
  }
}

function writeModConfigFile(): Promise<void> {
  const data = {
    Entries: [],
  };
  return fs.ensureFileAsync(modConfig()).then(() =>
    fs.writeFileAsync(modConfig(), JSON.stringify(data, undefined, 2), {
      encoding: "utf-8",
    }),
  );
}

function requiresLauncher(gamePath: string, store?: string) {
  return store === "xbox" ||
    gamePath.toLowerCase().includes(MODIFIABLE_WIN_APPS)
    ? Promise.resolve({
        launcher: "xbox",
        addInfo: {
          appId: MS_ID,
          parameters: [{ appExecName: "App" }],
        },
      })
    : Promise.resolve(undefined);
}

const emptyObj = {};
function init(context: types.IExtensionContext) {
  (context as any).registerGame({
    id: "pillarsofeternity2",
    name: "Pillars Of Eternity II:\tDeadfire",
    mergeMods: false,
    queryPath: findGame,
    queryModPath: (discoveryPath) => modPath(discoveryPath),
    logo: "gameart.png",
    executable,
    requiresLauncher,
    // There are absolutely NO common filepaths between the regular
    //  PoEII variant and the Game Pass variant. Which is why the
    //  requiredFiles array is empty.
    requiredFiles: [],
    supportedTools: tools,
    setup: prepareForModding,
    environment: {
      SteamAPPId: STEAM_ID,
    },
    details: {
      steamAppId: +STEAM_ID,
    },
  });

  context.registerMainPage("sort-none", "Load Order", LoadOrder, {
    id: "pillars2-loadorder",
    hotkey: "E",
    group: "per-game",
    visible: () =>
      selectors.activeGameId(context.api.store.getState()) ===
      "pillarsofeternity2",
    props: () => {
      const state: types.IState = context.api.store.getState();
      return {
        mods: state.persistent.mods["pillarsofeternity2"] || emptyObj,
        profile: selectors.activeProfile(state),
        loadOrder: getLoadOrder(),
        onSetLoadOrder: (order: ILoadOrder) => {
          setLoadOrder(order);
        },
      };
    },
  });

  context.registerAttributeExtractor(100, genAttributeExtractor(context.api));

  context.once(() => {
    context.api.events.on("gamemode-activated", (gameMode: string) => {
      if (gameMode === "pillarsofeternity2") {
        startWatch(context.api.store.getState())
          .catch(util.DataInvalid, (err) => {
            const errorMessage =
              "Your mod configuration file is invalid, you must remove/fix " +
              "this file for the mods to function correctly. The file is " +
              "located in: " +
              // tslint:disable-next-line:max-line-length
              '"C:\\Users\\{YOUR_USERNAME}\\AppData\\LocalLow\\Obsidian Entertainment\\Pillars of Eternity II\\modconfig.json"';
            context.api.showErrorNotification(
              "Invalid modconfig.json file",
              errorMessage,
              { allowReport: false },
            );
          })
          .catch((err) => {
            context.api.showErrorNotification("Failed to update modorder", err);
          });
      } else {
        stopWatch();
      }
    });

    context.api.setStylesheet(
      "game-pillarsofeternity2",
      path.join(__dirname, "stylesheet.scss"),
    );
  });

  return true;
}

export default init;
