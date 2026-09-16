import { log } from "../logging";
import type { EpicGamesLauncher } from "./EpicGamesLauncher";
import GameStoreHelper from "./GameStoreHelper";
import type { Steam } from "./Steam";

const warned = new Set<string>();

function warnDeprecated(method: string, replacement: string) {
  if (warned.has(method)) {
    return;
  }

  warned.add(method);
  log("warn", `"${method}" is deprecated`, {
    replacement,
  });
}

const GAME_STORE_DEPRECATION =
  "the steam / epicGamesLauncher exports on the extension api are deprecated";

type SteamShim = Pick<typeof GameStoreHelper, "findByAppId" | "findByName"> & Pick<Steam, "id">;

const steamShim: SteamShim = new Proxy<SteamShim>(
  {
    id: "steam",
    findByAppId: (appId) => GameStoreHelper.findByAppId(appId, "steam"),
    findByName: (name: string) => GameStoreHelper.findByName(name, "steam"),
  },
  {
    get(target, prop: keyof SteamShim) {
      warnDeprecated(
        `steam.${String(prop)}`,
        `${GAME_STORE_DEPRECATION}; use GameStoreHelper instead`,
      );

      if (prop in target) {
        return target[prop];
      }

      return undefined;
    },
  },
);

type EpicGamesLauncherShim = Pick<
  EpicGamesLauncher,
  "findByAppId" | "findByName" | "isGameInstalled"
>;

const epicGamesLauncherShim: EpicGamesLauncherShim = new Proxy<EpicGamesLauncherShim>(
  {
    findByAppId: (appId) => GameStoreHelper.findByAppId(appId, "epic"),
    findByName: (name) => GameStoreHelper.findByName(name, "epic"),
    isGameInstalled: (name) =>
      GameStoreHelper.findByAppId(name, "epic")
        .then(() => true)
        .catch(() =>
          GameStoreHelper.findByName(name, "epic")
            .then(() => true)
            .catch(() => false),
        ),
  },
  {
    get(target, prop: keyof EpicGamesLauncherShim) {
      warnDeprecated(
        `epicGamesLauncher.${String(prop)}`,
        `${GAME_STORE_DEPRECATION}; use GameStoreHelper instead`,
      );

      if (prop in target) {
        return target[prop];
      }

      return undefined;
    },
  },
);

export { steamShim, epicGamesLauncherShim };
