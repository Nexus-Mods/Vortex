import type { IExtensionApi } from "../../types/IExtensionContext";
import type { IGame } from "../../types/IGame";
import { ProcessCanceled } from "../../util/CustomErrors";
import { truthy } from "../../util/util";
import type { IDiscoveryResult } from "../gamemode_management/types/IDiscoveryResult";
import type { IGameVersionProvider } from "./types/IGameVersionProvider";

import { log } from "../../util/log";

import { getExecGameVersion } from "./util/getGameVersion";
import { unknownToError } from "@vortex/shared";

export default class GameVersionManager {
  private mApi: IExtensionApi;
  private mProviders: IGameVersionProvider[];
  constructor(api: IExtensionApi, providers: IGameVersionProvider[]) {
    this.mApi = api;
    this.mProviders = providers;
  }

  public async getSupportedProvider(
    game: IGame,
    discovery?: IDiscoveryResult,
  ): Promise<IGameVersionProvider> {
    for (const provider of this.mProviders) {
      const isSupported = await provider.supported(game, discovery);
      if (isSupported) {
        return Promise.resolve(provider);
      }
    }
  }

  public async getGameVersion(
    game: IGame,
    discovery: IDiscoveryResult,
  ): Promise<string> {
    if (!this.isGameValid(game, discovery)) {
      return Promise.reject(new ProcessCanceled("Game is not discovered"));
    }
    const provider: IGameVersionProvider = await this.getSupportedProvider(
      game,
      discovery,
    );
    try {
      const version = await provider.getGameVersion(game, discovery);
      return Promise.resolve(version);
    } catch (unknownErr) {
      const err = unknownToError(unknownErr);
      // fallback
      log("warn", "extension getGameVersion call failed", {
        message: err.message,
        stack: err.stack,
        extension: game.extensionPath,
      });
      return getExecGameVersion(game, discovery);
    }
  }

  private isGameValid(game: IGame, discovery: IDiscoveryResult): boolean {
    return (
      discovery?.path !== undefined &&
      truthy(game?.executable?.(discovery.path))
    );
  }
}
