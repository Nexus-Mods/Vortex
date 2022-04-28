import { IExtensionContext } from '../../types/IExtensionContext';
import local from '../../util/local';
import { wrapExtCBAsync } from '../../util/util';

import GameVersionManager from './GameVersionManager';
import {
  GameVersionProviderFunc, GameVersionProviderTest,
  IGameVersionProvider, IGameVersionProviderOptions,
} from './types/IGameVersionProvider';
import {
  getExecGameVersion, getExtGameVersion,
  testExecProvider, testExtProvider,
} from './util/getGameVersion';

// oh boy
const $ = local<{
  gameVersionManager: GameVersionManager,
}>('gameversion-manager', {
  gameVersionManager: undefined,
});

const gameVersionProviders: IGameVersionProvider[] = [];

function init(context: IExtensionContext): boolean {
  context.registerGameVersionProvider =
    ((id: string, priority: number, supported: GameVersionProviderTest,
      getGameVersion: GameVersionProviderFunc, options?: IGameVersionProviderOptions,
      extPath?: any) => {
        // TODO: replace this with a proper validator.
        const provider: IGameVersionProvider = { id, priority, supported, getGameVersion };
        if (!provider) {
          context.api.showErrorNotification('Invalid game version provider', undefined, {
            message: 'A game version provider has failed to initialize',
          });
          return;
        }
        gameVersionProviders.push({
          id,
          priority,
          supported: wrapExtCBAsync(supported, extPath),
          getGameVersion: wrapExtCBAsync(getGameVersion, extPath),
          options,
        });
        gameVersionProviders.sort((lhs, rhs) => lhs.priority - rhs.priority);
  }) as any;

  context.registerGameVersionProvider('ext-version-check',
    20, testExtProvider, getExtGameVersion);
  context.registerGameVersionProvider('exec-version-check',
    100, testExecProvider, getExecGameVersion);
  context.registerGameVersionProvider('fallback',
    1000, () => Promise.resolve(true), () => Promise.resolve('0.0.0'));

  context.once(() => {
    $.gameVersionManager = new GameVersionManager(context.api, gameVersionProviders);
  });

  return true;
}

export default init;
