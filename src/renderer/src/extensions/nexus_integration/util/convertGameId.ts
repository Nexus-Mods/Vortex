import { inspect } from "util";

import { GameDomain, getErrorMessageOrDefault, VortexGameId } from "@vortex/shared";

import { log } from "@/logging";

import type { IGame } from "../../../types/IGame";
import type { IState } from "../../../types/IState";
import { SITE_ID } from "../../gamemode_management/constants";
// the game selectors directly rather than through util/selectors: that barrel re-exports this
// extension's own selectors, and importing it from here would close an import cycle onto a leaf
// module that some forty files depend on
import { gameById, knownGames } from "../../gamemode_management/selectors";
import type { IGameStored, IGameStoredExt } from "../../gamemode_management/types/IGameStored";

/**
 * get the nexus page id for a game
 * TODO: some games have hard-coded transformations here, should move all of that to game.details
 *
 * @deprecated Use `convertId(gameData(state), { vortexGameId }, "gameDomain")`. This helper guesses
 * a domain from the game id when the game declares none; `convertId` returns `undefined` instead.
 */
export function nexusGameId(
  game: IGameStored | IGame,
  fallbackGameId?: string,
): GameDomain | undefined {
  if (game === undefined && fallbackGameId === undefined) {
    return undefined;
  }

  if (
    game &&
    game.details !== undefined &&
    "nexusPageId" in game.details &&
    typeof game.details.nexusPageId === "string"
  ) {
    return GameDomain(game.details.nexusPageId);
  }

  const gameId = game?.id ?? fallbackGameId;

  try {
    return GameDomain(
      {
        skyrimse: "skyrimspecialedition",
        skyrimvr: "skyrimspecialedition",
        falloutnv: "newvegas",
        fallout4vr: "fallout4",
        teso: "elderscrollsonline",
      }[gameId.toLowerCase()] || gameId,
    );
  } catch (err) {
    log("error", "failed to convert game id to domain", {
      message: getErrorMessageOrDefault(err),
      game: inspect(game),
      fallbackGameId,
    });

    throw err;
  }
}

/**
 * get our internal game id for a nexus page id
 *
 * @deprecated Use `convertId(gameData(state), { gameDomain }, "vortexGameId")`. This helper falls
 * back to the input as a game id when no known game matches; `convertId` returns `undefined` instead.
 */
export function convertGameIdReverse(knownGames: IGameStored[], input: string): VortexGameId {
  // an empty string is no game id either, and branding one would throw
  if (input?.toLowerCase === undefined || input === "") {
    return undefined;
  }

  const validGames = knownGames.filter(
    (iter) =>
      iter.id === input.toLowerCase() ||
      (iter.details !== undefined && iter.details.nexusPageId === input),
  );

  // We obviously prefer the exact match first.
  const game = validGames.find((iter) => iter.id === input.toLowerCase());
  // the stored games are keyed by the id their extension registered
  if (game !== undefined) {
    return VortexGameId(game.id);
  }

  // Alternatively - there may be a nexus page id match.
  if (validGames.length > 0) {
    return VortexGameId(validGames[0].id);
  }

  // no known game matches: assume an extension game that isn't registered (yet) uses the domain as its id
  return VortexGameId(
    {
      skyrimspecialedition: "skyrimse",
      newvegas: "falloutnv",
      elderscrollsonline: "teso",
    }[input.toLowerCase()] || input.toLowerCase(),
  );
}

/**
 * the nexus page id (domain) for the game an nxm url names, mapping the link's game id through
 * the games Vortex knows about
 */
export function nxmPageId(state: IState, nxmGameId: string): GameDomain {
  const gameId = convertNXMIdReverse(knownGames(state), nxmGameId);
  return nexusGameId(gameById(state, gameId), nxmGameId);
}

/**
 * get our internal game id for a nxm link id
 */
export function convertNXMIdReverse(knownGames: IGameStored[], input: string): VortexGameId {
  if (input === undefined || input === "") {
    return undefined;
  }

  const clearGameMatch = knownGames.find((iter) => iter.id === input.toLowerCase());
  if (clearGameMatch) {
    return VortexGameId(clearGameMatch.id);
  }

  const game = knownGames.find(
    (iter) =>
      iter.details !== undefined &&
      (iter.details.nxmLinkId === input || iter.details.nexusPageId === input),
  );

  if (game !== undefined) {
    return VortexGameId(game.id);
  }

  return VortexGameId(input.toLowerCase());
}

/**
 * get the nxm link id for a game
 */
export function toNXMId(game: IGameStoredExt, gameId: string): string {
  // this is a bit of a workaround since "site" isn't and shouldn't be an
  // entry in the list of games (here or on the site)
  if (game == null) {
    return SITE_ID;
  }
  if (!!game.downloadGameId && game.downloadGameId !== game.id) {
    return game.downloadGameId;
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
  if (gameIdL === "skyrimse") {
    return "SkyrimSE";
  } else if (gameIdL === "fallout4vr") {
    return "fallout4";
  } else {
    return gameId;
  }
}
