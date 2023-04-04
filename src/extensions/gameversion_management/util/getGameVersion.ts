import { IGame } from '../../../types/IGame';
import { statAsync } from '../../../util/fs';
import lazyRequire from '../../../util/lazyRequire';
import { log } from '../../../util/log';
import { IDiscoveryResult } from '../../gamemode_management/types/IDiscoveryResult';

import * as exeVersionT from 'exe-version';
import path from 'path';

const exeVersion: typeof exeVersionT = lazyRequire(() => require('exe-version'));

export async function testExtProvider(game: IGame, discovery: IDiscoveryResult): Promise<boolean> {
  return Promise.resolve(game.getGameVersion !== undefined);
}

export async function getExtGameVersion(game: IGame, discovery: IDiscoveryResult): Promise<string> {
  try {
    const version: string =
      await game.getGameVersion(discovery.path, discovery.executable || game.executable());
    if (typeof version !== 'string') {
      return Promise.reject(new Error('getGameVersion functor returned an invalid type'));
    }

    return version;
  } catch (err) {
    return Promise.reject(err);
  }
}

export async function testExecProvider(game: IGame, discovery: IDiscoveryResult): Promise<boolean> {
  const exeName = discovery.executable || game.executable();
  if ((discovery?.path === undefined) || (exeName === undefined)) {
    // can be caused by a broken extension
    return Promise.resolve(false);
  }
  const exePath = path.join(discovery.path, exeName);
  try {
    await statAsync(exePath);
    const version: string = exeVersion.default(exePath);
    return version === '0.0.0'
      ? Promise.resolve(false)
      : Promise.resolve(true);
  } catch (err) {
    log('error', 'unable to test executable version fields', err);
    return Promise.resolve(false);
  }
}

export async function getExecGameVersion(game: IGame,
                                         discovery: IDiscoveryResult): Promise<string> {
  const exePath = path.join(discovery.path, discovery.executable || game.executable());
  try {
    const version: string = exeVersion.default(exePath);
    return Promise.resolve(version);
  } catch (err) {
    return Promise.resolve('0.0.0');
  }
}
