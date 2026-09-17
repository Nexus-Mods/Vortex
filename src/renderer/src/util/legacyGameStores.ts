import { registerDeprecatedApi, wrapDeprecatedSurface } from "./deprecatedApiUsage";
import type { EpicGamesLauncher } from "./EpicGamesLauncher";
import GameStoreHelper from "./GameStoreHelper";
import type { Steam } from "./Steam";

const GAME_STORE_DEPRECATION =
  "the steam / epicGamesLauncher exports on the extension api are deprecated; use GameStoreHelper instead";

type SteamShim = Pick<typeof GameStoreHelper, "findByAppId" | "findByName"> & Pick<Steam, "id">;

/** Deprecated shim, use GameStoreHelper instead.
 *
 * @public
 * @deprecated
 * */
const steamShim: SteamShim = {
  id: "steam",
  findByAppId: (appId) => GameStoreHelper.findByAppId(appId, "steam"),
  findByName: (name: string) => GameStoreHelper.findByName(name, "steam"),
};

type EpicGamesLauncherShim = Pick<
  EpicGamesLauncher,
  "findByAppId" | "findByName" | "isGameInstalled"
>;

/** Deprecated shim, use GameStoreHelper instead.
 *
 * @public
 * @deprecated
 * */
const epicGamesLauncherShim: EpicGamesLauncherShim = {
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
};

registerDeprecatedApi("util.steam", {
  makeForCaller: (report) =>
    wrapDeprecatedSurface("steam", GAME_STORE_DEPRECATION, steamShim, report),
});

registerDeprecatedApi("util.epicGamesLauncher", {
  makeForCaller: (report) =>
    wrapDeprecatedSurface(
      "epicGamesLauncher",
      GAME_STORE_DEPRECATION,
      epicGamesLauncherShim,
      report,
    ),
});

export { steamShim, epicGamesLauncherShim };
