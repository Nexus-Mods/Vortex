import { IGame } from '../../../types/IGame';
import { IGameStored } from '../../../types/IState';
import { SITE_ID } from '../../gamemode_management/constants';

/**
 * get the nexus page id for a game
 * TODO: some games have hard-coded transformations here, should move all of that to game.details
 */
export function nexusGameId(game: IGameStored | IGame, fallbackGameId?: string): string {
  if ((game === undefined) && (fallbackGameId === undefined)) {
    return undefined;
  }

  if ((game !== undefined)
      && (game.details !== undefined)
      && (game.details.nexusPageId !== undefined)) {
    return game.details.nexusPageId;
  }

  const gameId = (game !== undefined)
    ? game.id
    : fallbackGameId;

  return {
    skyrimse: 'skyrimspecialedition',
    skyrimvr: 'skyrimspecialedition',
    falloutnv: 'newvegas',
    fallout4vr: 'fallout4',
    teso: 'elderscrollsonline',
  }[gameId.toLowerCase()] || gameId;
}

/**
 * get our internal game id for a nexus page id
 */
export function convertGameIdReverse(knownGames: IGameStored[], input: string): string {
  if (input === undefined) {
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
export function toNXMId(game: IGameStored, gameId: string): string {
  // this is a bit of a workaround since "site" isn't and shouldn't be an
  // entry in the list of games (here or on the site)
  if (game === null) {
    return SITE_ID;
  }
  if (game.details !== undefined) {
    if (game.details.nxmLinkId !== undefined) {
      return game.details.nxmLinkId;
    } else if (game.details.nexusPageId !== undefined) {
      return game.details.nexusPageId;
    }
    gameId = game.id;
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
