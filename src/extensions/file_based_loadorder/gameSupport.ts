import path from 'path';

import { COMPANY_ID } from '../../util/constants';
import * as fs from '../../util/fs';
import { log } from '../../util/log';
import { checkAndLogDuplicateGameEntry } from '../loadOrderUtils';
import { ILoadOrderGameInfo, ILoadOrderGameInfoExt } from './types/types';

const gameSupport: ILoadOrderGameInfoExt[] = [];
export function addGameEntry(gameEntry: ILoadOrderGameInfo, extPath: string) {
  if (gameEntry === undefined) {
    log('error', 'unable to add load order page - invalid game entry');
    return;
  }

  if (checkAndLogDuplicateGameEntry(gameEntry.gameId, gameSupport, 'file_based_loadorder')) {
    return;
  }

  // The LO page registration can be done as an "addon" through
  //  another extension - which means we could have an officially supported
  //  game extension but an unofficial load order registration so checking if
  //  game.contributed === undefined is not sufficient - we need to read the
  //  info.json file of the extension that registers the LO page.
  let gameExtInfo;
  try {
    gameExtInfo = JSON.parse(fs.readFileSync(path.join(extPath, 'info.json'), { encoding: 'utf8' }));
  } catch (err) {
    log('error', 'Failed to parse extension information', err);
    return;
  }

  gameSupport.push({ ...gameEntry, isContributed: gameExtInfo.author !== COMPANY_ID });
}

export function findGameEntry(gameId: string): ILoadOrderGameInfoExt {
  return gameSupport.find(game => game.gameId === gameId);
}
