import path from "path";

import { log, util } from "@nexusmods/vortex-api";
import type { types } from "@nexusmods/vortex-api";

import {
  DARKSOULS2_GAME_ID,
  DARKSOULS2_PRIORITIES,
  installGameDir,
  installReplacement,
  installTextures,
  testGameDir,
  testReplacement,
  testTextures,
} from "./installers";

const EXEC_PATH = path.join("Game", "DarksoulsII.exe");

/**
 * Tools that ship with mods rather than with the game, so they only appear once
 * the relevant mod is deployed. `relative: true` makes Vortex look for them
 * under the discovered game directory; `requiredFiles` is what gates them from
 * showing up before the mod is installed.
 *
 * Deliberately not `defaultPrimary`: the Seamless Co-op author is explicit that
 * you use the launcher when you want co-op and otherwise run the game normally,
 * so it sits alongside the game rather than taking over the Play button.
 */
const TOOLS: types.ITool[] = [
  {
    id: "ds2seamlesscoop",
    name: "Dark Souls II Seamless Co-op",
    shortName: "Co-op",
    logo: "seamlesscoop.png",
    executable: () => path.join("Game", "ds2sc_launcher.exe"),
    requiredFiles: [path.join("Game", "ds2sc_launcher.exe")],
    relative: true,
    exclusive: true,
  },
];

class DarkSouls2 implements types.IGame {
  public context: types.IExtensionContext;
  public id: string;
  public name: string;
  public mergeMods: boolean;
  public logo: string;
  public environment: { [key: string]: string };
  public details: { [key: string]: unknown };
  public requiredFiles: string[];
  public supportedTools: types.ITool[];

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
    this.supportedTools = TOOLS;
  }

  public queryPath() {
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
  context.registerGame(new DarkSouls2(context));

  context.registerInstaller(
    "darksouls2-gamedir",
    DARKSOULS2_PRIORITIES.gameDir,
    testGameDir,
    installGameDir,
  );

  context.registerInstaller(
    "darksouls2-replacement",
    DARKSOULS2_PRIORITIES.replacement,
    testReplacement,
    installReplacement,
  );

  context.registerInstaller(
    "darksouls2-textures",
    DARKSOULS2_PRIORITIES.textures,
    (files, gameId) => testTextures(files, gameId, isGedosatoInstalled(context.api)),
    installTextures,
  );

  return true;
}

export default main;
