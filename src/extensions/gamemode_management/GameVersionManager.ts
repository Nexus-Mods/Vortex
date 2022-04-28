import { IExtensionApi } from '../../types/IExtensionContext';
import { IGame } from '../../types/IGame';
import { ProcessCanceled } from '../../util/CustomErrors';
import { truthy } from '../../util/util';
import { discoveryByGame } from './selectors';
import { IDiscoveryResult } from './types/IDiscoveryResult';
import { IGameVersionProvider } from './types/IGameVersionProvider';
import { getGame } from './util/getGame';

import { log } from '../../util/log';

import { getExecGameVersion } from './util/getGameVersion';

export default class GameVersionManager {
  private mApi: IExtensionApi;
  private mProviders: IGameVersionProvider[];
  constructor(api: IExtensionApi, providers: IGameVersionProvider[]) {
    this.mApi = api;
    this.mProviders = providers;
  }

  public async getSupportedProvider<T>(gameInstance: T,
                                       discovery?: IDiscoveryResult)
                                        : Promise<IGameVersionProvider> {
    let game;
    if (typeof gameInstance === 'string') {
      const state = this.mApi.getState();
      discovery = discoveryByGame(state, gameInstance);
      game = getGame(gameInstance);
      if (!this.isGameValid(game, discovery)) {
        return Promise.reject(new ProcessCanceled('Game is not discovered'));
      }
    } else {
      game = gameInstance;
    }

    for (const provider of this.mProviders) {
      const isSupported = await provider.supported(game, discovery);
      if (isSupported) {
        return Promise.resolve(provider);
      }
    }
  }

  public async getGameVersion(game: IGame, discovery: IDiscoveryResult): Promise<string> {
    if (!this.isGameValid(game, discovery)) {
      return Promise.reject(new ProcessCanceled('Game is not discovered'));
    }
    const provider: IGameVersionProvider = await this.getSupportedProvider(game, discovery);
    try {
      const version = await provider.getGameVersion(game, discovery);
      return Promise.resolve(version);
    } catch (err) {
      // fallback
      log('warn', 'extension getGameVersion call failed',
        { message: err.message, stack: err.stack, extension: game.extensionPath });
      return getExecGameVersion(game, discovery);
    }
  }

  private isGameValid(game: IGame, discovery: IDiscoveryResult): boolean {
    return (discovery?.path !== undefined ||
      (game?.executable !== undefined && truthy(game.executable(discovery.path))));
  }
}
