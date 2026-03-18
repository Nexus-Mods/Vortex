import { getErrorMessageOrDefault, unknownToError } from "@vortex/shared";
import { useMemo } from "react";
import { shallowEqual, useSelector } from "react-redux";

import type { IToolStored } from "../../../extensions/gamemode_management/types/IToolStored";
import type { IDiscoveredTool } from "../../../types/IDiscoveredTool";
import type { IState } from "../../../types/IState";

import { log } from "../../../util/log";
import {
  activeGameId,
  currentGame,
  currentGameDiscovery,
} from "../../../util/selectors";
import StarterInfo from "../../../util/StarterInfo";

export interface UseToolsDataResult {
  gameId: string | undefined;
  gameStarter: StarterInfo | undefined;
  tools: StarterInfo[];
  discoveredTools: { [key: string]: IDiscoveredTool };
  discoveryPath: string | undefined;
  primaryToolId: string | undefined;
}

/**
 * Hook to fetch and create tool data from Redux state.
 * Returns the game starter, tools list, and related metadata.
 */
export const useToolsData = (): UseToolsDataResult => {
  const gameId = useSelector((state: IState) => activeGameId(state));
  const game = useSelector((state: IState) => currentGame(state));
  const gameDiscovery = useSelector((state: IState) =>
    currentGameDiscovery(state),
  );
  const discoveredTools = useSelector(
    (state: IState) =>
      state.settings?.gameMode?.discovered?.[gameId ?? ""]?.tools ?? {},
    shallowEqual,
  );
  const toolsOrder = useSelector(
    (state: IState) =>
      state.settings?.interface?.tools?.order?.[gameId ?? ""] ?? [],
    shallowEqual,
  );
  const primaryToolId = useSelector(
    (state: IState) =>
      state.settings?.interface?.primaryTool?.[gameId ?? ""] ?? undefined,
  );

  const gameStarter = useMemo((): StarterInfo | undefined => {
    if (!game || gameDiscovery?.path === undefined) {
      return undefined;
    }
    try {
      return new StarterInfo(game, gameDiscovery);
    } catch (unknownError) {
      const err = unknownToError(unknownError);
      log("error", "failed to create game starter", {
        error: err.message,
        stack: err.stack,
      });
      return undefined;
    }
  }, [game, gameDiscovery]);

  const tools = useMemo((): StarterInfo[] => {
    if (!game || gameDiscovery?.path === undefined) {
      return [];
    }

    const knownTools = game?.supportedTools ?? Array<IToolStored>();
    const preConfTools = new Set<string>(knownTools.map((tool) => tool.id));

    const starters: StarterInfo[] = [];

    // Add tools provided by the game extension
    knownTools.forEach((tool: IToolStored) => {
      try {
        starters.push(
          new StarterInfo(game, gameDiscovery, tool, discoveredTools[tool.id]),
        );
      } catch (err) {
        log("warn", "invalid tool", { err });
      }
    });

    // Add manually added tools
    Object.keys(discoveredTools)
      .filter(
        (toolId) => !preConfTools.has(toolId) && toolId !== gameStarter?.id,
      )
      .sort((lhs, rhs) => {
        const tlhs = discoveredTools[lhs]?.timestamp || 0;
        const trhs = discoveredTools[rhs]?.timestamp || 0;
        return tlhs - trhs;
      })
      .forEach((toolId) => {
        try {
          starters.push(
            new StarterInfo(
              game,
              gameDiscovery,
              undefined,
              discoveredTools[toolId],
            ),
          );
        } catch (err) {
          log("error", "tool configuration invalid", {
            gameId,
            toolId,
            error: getErrorMessageOrDefault(err),
          });
        }
      });

    // Sort by user-defined order
    const findIdx = (starter: StarterInfo) => {
      const idx = toolsOrder.findIndex((toolId) => toolId === starter.id);
      return idx !== -1 ? idx : starters.length;
    };
    starters.sort((lhs, rhs) => findIdx(lhs) - findIdx(rhs));

    return starters;
  }, [
    game,
    gameDiscovery,
    discoveredTools,
    toolsOrder,
    gameStarter?.id,
    gameId,
  ]);

  return {
    gameId,
    gameStarter,
    tools,
    discoveredTools,
    discoveryPath: gameDiscovery?.path,
    primaryToolId,
  };
};
