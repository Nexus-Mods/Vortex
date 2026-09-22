import path from "path";

import { log, util } from "@nexusmods/vortex-api";
import type { types } from "@nexusmods/vortex-api";

import {
  DARKSOULS2_GAME_ID,
  DARKSOULS2_PRIORITIES,
  installGameDir,
  installTextures,
  testGameDir,
  testTextures,
} from "./installers";

const EXEC_PATH = path.join("Game", "DarksoulsII.exe");

class DarkSouls2 {
  public context: types.IExtensionContext;
  public id: string;
  public name: string;
  public mergeMods: boolean;
  public logo: string;
  public environment: { [key: string]: string };
  public details: { [key: string]: unknown };
  public requiredFiles: string[];

  constructor(context: types.IExtensionContext) {
    this.context = context;
    this.id = DARKSOULS2_GAME_ID;
    this.name = "Dark Souls II";
    this.mergeMods = true;
    this.logo = "gameart.jpg";
    this.environment = {
      SteamAPPId: "236430",
    };
    this.details = {
      steamAppId: 236430,
    };
    this.requiredFiles = [EXEC_PATH];
  }

  public queryPath(): PromiseLike<string> {
    return util.GameStoreHelper.findByAppId(["236430", "335300"], "steam").then((game) => {
      if (game.appid === "335300") {
        this.details = {
          steamAppId: game.appid,
        };
      }
      return game.gamePath;
    });
  }

  /**
   * Stays `"."`, and must. Dark Souls II mods are routed by prefixing
   * destinations with `Game/` (see installers.ts, and `modtype-dinput` for the
   * ModEngine case). Returning `"Game"` here would resolve those already
   * prefixed paths against `<root>/Game`, sending every ModEngine mod to
   * `<root>/Game/Game/dinput8.dll`.
   */
  public queryModPath(): string {
    return ".";
  }

  public executable(): string {
    return EXEC_PATH;
  }
}

/**
 * True when the `gedosato` modType resolves to a real path, which it only does
 * when GeDoSaTo is installed. `getModPaths` drops any modType whose `getPath`
 * returns undefined, which is the same mechanism that makes a mod assigned that
 * modType silently never deploy.
 */
function isGedosatoInstalled(api: types.IExtensionApi): boolean {
  try {
    const discovery = api.getState().settings.gameMode.discovered?.[DARKSOULS2_GAME_ID];
    if (discovery?.path === undefined) {
      return false;
    }
    const game = util.getGame(DARKSOULS2_GAME_ID);
    return game?.getModPaths?.(discovery.path)?.["gedosato"] !== undefined;
  } catch (err) {
    log("warn", "darksouls2: failed to check whether GeDoSaTo is installed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

function main(context: types.IExtensionContext): boolean {
  context.registerGame(new DarkSouls2(context) as unknown as types.IGame);

  context.registerInstaller(
    "darksouls2-gamedir",
    DARKSOULS2_PRIORITIES.gameDir,
    testGameDir as unknown as types.TestSupported,
    installGameDir as unknown as types.InstallFunc,
  );

  context.registerInstaller(
    "darksouls2-textures",
    DARKSOULS2_PRIORITIES.textures,
    ((files: string[], gameId: string) =>
      testTextures(
        files,
        gameId,
        isGedosatoInstalled(context.api),
      )) as unknown as types.TestSupported,
    installTextures as unknown as types.InstallFunc,
  );

  return true;
}

export default main;
