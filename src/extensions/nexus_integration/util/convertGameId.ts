import { inspect } from 'util';
import { IGame } from '../../../types/IGame';
import { log } from '../../../util/log';
import { truthy } from '../../../util/util';
import { SITE_ID } from '../../gamemode_management/constants';
import { IGameStored, IGameStoredExt } from '../../gamemode_management/types/IGameStored';

/**
 * get the nexus page id for a game
 * TODO: some games have hard-coded transformations here, should move all of that to game.details
 */
export function nexusGameId(game: IGameStored | IGame, fallbackGameId?: string): string {
  if ((game === undefined) && (fallbackGameId === undefined)) {
    return undefined;
  }

  if (truthy(game)
      && (game.details !== undefined)
      && (game.details.nexusPageId !== undefined)) {
    return game.details.nexusPageId;
  }

  const gameId = game?.id ?? fallbackGameId;

  try {
    return {
      skyrimse: 'skyrimspecialedition',
      skyrimvr: 'skyrimspecialedition',
      falloutnv: 'newvegas',
      fallout4vr: 'fallout4',
      teso: 'elderscrollsonline',
    }[gameId.toLowerCase()] || gameId;
  } catch (err) {
    log('error', 'failed to convert game id to domain', {
      message: err.message,
      game: inspect(game),
      fallbackGameId,
    });
    throw err;
  }
}

/**
 * get our internal game id for a nexus page id
 */
export function convertGameIdReverse(knownGames: IGameStored[], input: string): string {
  if (input?.toLowerCase === undefined) {
    return undefined;
  }

  const game = knownGames.find(iter =>
    (iter.details !== undefined) && (iter.details.nexusPageId === input));
  if (game !== undefined) {
    return game.id;
  }

  return {
    skyrimspecialedition: 'skyrimse',
    newvegas: 'falloutnv',
    elderscrollsonline: 'teso',
  }[input.toLowerCase()] || input;
}

/**
 * get our internal game id for a nxm link id
 */
export function convertNXMIdReverse(knownGames: IGameStored[], input: string): string {
  if (input === undefined) {
    return undefined;
  }

  const clearGameMatch = knownGames.find(iter => iter.id === input.toLowerCase());
  if (clearGameMatch) {
    return clearGameMatch.id;
  }

  const game = knownGames.find(iter =>
    (iter.details !== undefined) &&
    ((iter.details.nxmLinkId === input) || (iter.details.nexusPageId === input)));

  if (game !== undefined) {
    return game.id;
  }

  return input.toLowerCase();
}

/**
 * get the nxm link id for a game
 */
export function toNXMId(game: IGameStoredExt, gameId: string): string {
  // this is a bit of a workaround since "site" isn't and shouldn't be an
  // entry in the list of games (here or on the site)
  if (!game && !gameId) {
    return SITE_ID;
  }
  if (game?.details !== undefined) {
    if (game.details.nxmLinkId !== undefined) {
      return game.details.nxmLinkId;
    } else if (game.details.nexusPageId !== undefined) {
      return game.details.nexusPageId;
    }
    gameId = game.downloadGameId || game.id;
  }
  const gameIdL = gameId.toLowerCase();
  if (gameIdL === 'skyrimse') {
    return 'SkyrimSE';
  } else if (gameIdL === 'fallout4vr') {
    return 'fallout4';
  } else {
    return gameId;
  }
}
