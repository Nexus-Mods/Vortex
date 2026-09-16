import { registerDeprecatedApi, type DeprecatedApiReporter } from "./deprecatedApiUsage";
import type { EpicGamesLauncher } from "./EpicGamesLauncher";
import GameStoreHelper from "./GameStoreHelper";
import type { Steam } from "./Steam";

const GAME_STORE_DEPRECATION =
  "the steam / epicGamesLauncher exports on the extension api are deprecated";

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

function withAttribution<T extends object>(
  surface: string,
  target: T,
  report: DeprecatedApiReporter,
): T {
  return new Proxy<T>(target, {
    get(innerTarget, prop, receiver) {
      report(
        `${surface}.${String(prop)}`,
        `${GAME_STORE_DEPRECATION}; use GameStoreHelper instead`,
      );
      return Reflect.get(innerTarget, prop, receiver);
    },
  });
}

registerDeprecatedApi("util.steam", {
  makeForCaller: (report) => withAttribution("steam", steamShim, report),
});

registerDeprecatedApi("util.epicGamesLauncher", {
  makeForCaller: (report) => withAttribution("epicGamesLauncher", epicGamesLauncherShim, report),
});

export { steamShim, epicGamesLauncherShim };
