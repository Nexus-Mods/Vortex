import path from "path";

import { util } from "@nexusmods/vortex-api";
import type { types } from "@nexusmods/vortex-api";

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
    this.id = "darksouls2";
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

  public queryModPath(): string {
    return ".";
  }

  public executable(): string {
    return EXEC_PATH;
  }
}

function main(context: types.IExtensionContext): boolean {
  context.registerGame(new DarkSouls2(context) as unknown as types.IGame);

  return true;
}

export default main;
