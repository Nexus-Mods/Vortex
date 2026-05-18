import { getErrorMessageOrDefault, unknownToError } from "@vortex/shared";

import type { IDiscoveredTool, IToolStored } from "../../../types/api";
import type { IDiscoveryResult, IGameStored } from "../../../types/IState";
import { log } from "../../../util/log";
import StarterInfo from "../../../util/StarterInfo";
import { getSafe } from "../../../util/storeHelper";

export const generateGameStarter = (
  knownGames: IGameStored[],
  discoveredGames: Record<string, IDiscoveryResult>,
  gameMode: string,
): StarterInfo => {
  const game = knownGames.find((g: IGameStored) => g.id === gameMode);
  const discoveredGame = discoveredGames[gameMode];

  if (game === undefined || discoveredGame?.path === undefined) {
    return null;
  }
  try {
    return new StarterInfo(game, discoveredGame);
  } catch (unknownError) {
    const err = unknownToError(unknownError);
    log("error", "failed to create game entry", {
      error: err.message,
      stack: err.stack,
    });
  }
  return null;
};

export const generateToolStarters = (
  knownGames: IGameStored[],
  discoveredGames: Record<string, IDiscoveryResult>,
  discoveredTools: Record<string, IDiscoveredTool>,
  toolsOrder: string[],
  gameMode: string,
  gameStarterId: string,
): StarterInfo[] => {
  const game = knownGames.find((g: IGameStored) => g.id === gameMode);
  const discoveredGame = discoveredGames[gameMode];

  if (game === undefined || discoveredGame?.path === undefined) {
    return [];
  }

  const knownTools = getSafe(game, ["supportedTools"], Array<IToolStored>());
  const gameId = discoveredGame.id || game.id;
  const preConfTools = new Set<string>(knownTools.map((tool) => tool.id));

  const starters: StarterInfo[] = [];

  knownTools.forEach((tool: IToolStored) => {
    try {
      starters.push(new StarterInfo(game, discoveredGame, tool, discoveredTools[tool.id]));
    } catch (err) {
      log("warn", "invalid tool", { err });
    }
  });

  Object.keys(discoveredTools)
    .filter((toolId) => !preConfTools.has(toolId) && toolId !== gameStarterId)
    .sort((lhs, rhs) => {
      const tlhs = discoveredTools[lhs]?.timestamp || 0;
      const trhs = discoveredTools[rhs]?.timestamp || 0;
      return tlhs - trhs;
    })
    .forEach((toolId) => {
      try {
        starters.push(new StarterInfo(game, discoveredGame, undefined, discoveredTools[toolId]));
      } catch (err) {
        log("error", "tool configuration invalid", {
          gameId,
          toolId,
          error: getErrorMessageOrDefault(err),
        });
      }
    });

  const findIdx = (starter: StarterInfo) => {
    const idx = toolsOrder.findIndex((toolId) => toolId === starter.id);
    return idx !== -1 ? idx : starters.length;
  };
  starters.sort((lhs, rhs) => findIdx(lhs) - findIdx(rhs));
  return starters;
};
