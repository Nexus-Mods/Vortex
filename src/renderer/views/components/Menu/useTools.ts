import { useCallback, useMemo } from "react";

import type { IExtensionApi } from "../../../../types/api";
import type { IStarterInfo } from "../../../../util/StarterInfo";

import { log } from "../../../../util/log";
import { activeProfile } from "../../../../util/selectors";
import StarterInfo from "../../../../util/StarterInfo";
import { useToolsData } from "./useToolsData";
import { useToolsRunning } from "./useToolsRunning";
import { useToolsValidation } from "./useToolsValidation";

const MAX_VISIBLE_TOOLS = 5;

export type ShowErrorCallback = (
  message: string,
  details?: string | Error,
  allowReport?: boolean,
) => void;

export interface UseToolsResult {
  gameId: string | undefined;
  visibleTools: IStarterInfo[];
  primaryStarter: IStarterInfo | undefined;
  primaryToolId: string | undefined;
  isPrimaryRunning: boolean;
  exclusiveRunning: boolean;
  isToolRunning: (toolExePath: string) => boolean;
  startTool: (info: IStarterInfo) => void;
  handlePlay: () => void;
}

/**
 * Hook to access tools data for the current game.
 * Composes useToolsData, useToolsValidation, and useToolsRunning.
 * Provides visible tools, primary starter, running state, and actions.
 */
export const useTools = (
  onShowError: ShowErrorCallback,
  api: IExtensionApi,
): UseToolsResult => {
  const {
    gameId,
    gameStarter,
    tools,
    discoveredTools,
    discoveryPath,
    primaryToolId,
  } = useToolsData();

  // Get all starters for validation
  const allStarters = useMemo(
    () => (gameStarter ? [gameStarter, ...tools] : tools),
    [gameStarter, tools],
  );

  const { isToolValid } = useToolsValidation(allStarters, discoveryPath);

  const { exclusiveRunning, isToolRunning } = useToolsRunning();

  // Determine the primary starter (tool or game)
  const primaryStarter = useMemo((): IStarterInfo | undefined => {
    if (primaryToolId) {
      const primaryTool = tools.find((tool) => tool.id === primaryToolId);
      if (primaryTool?.exePath) {
        return primaryTool;
      }
    }
    return gameStarter;
  }, [primaryToolId, tools, gameStarter]);

  // Check if primary starter is running
  const isPrimaryRunning = useMemo(
    () => isToolRunning(primaryStarter?.exePath ?? ""),
    [isToolRunning, primaryStarter?.exePath],
  );

  // Filter visible tools (valid, not hidden, includes game starter)
  const visibleTools = useMemo(() => {
    const result: IStarterInfo[] = [];

    // Add game starter first if available and valid
    if (gameStarter && isToolValid(gameStarter)) {
      result.push(gameStarter);
    }

    // Add tools that are valid and not hidden
    const visibleToolsList = tools.filter(
      (starter) =>
        isToolValid(starter) &&
        (starter.isGame ||
          discoveredTools[starter.id] === undefined ||
          discoveredTools[starter.id].hidden !== true),
    );

    result.push(...visibleToolsList);

    return result.slice(0, MAX_VISIBLE_TOOLS);
  }, [gameStarter, tools, discoveredTools, isToolValid]);

  const startTool = useCallback(
    (info: IStarterInfo) => {
      if (info?.exePath === undefined) {
        onShowError(
          "Tool missing/misconfigured",
          "Please ensure that the tool/game is configured correctly and try again",
          false,
        );
        return;
      }
      api.events.emit(
        "analytics-track-click-event",
        "Tools",
        "Manually ran tool",
      );
      StarterInfo.run(info, api, onShowError);
    },
    [api, onShowError],
  );

  const handlePlay = useCallback(() => {
    if (!primaryStarter) {
      onShowError(
        "No game configured",
        "Please ensure that a game is configured and discovered",
        false,
      );
      return;
    }

    api.events.emit("analytics-track-click-event", "Menu", "Play game");

    const state = api.getState();
    const profile = activeProfile(state);
    const currentModsState = profile?.modState ?? {};
    const enabledMods = Object.keys(currentModsState).filter(
      (modId) => currentModsState?.[modId]?.enabled ?? false,
    );

    log("info", `Enabled mods at game launch: ${enabledMods.length}`);

    StarterInfo.run(primaryStarter as StarterInfo, api, onShowError);
  }, [primaryStarter, api, onShowError]);

  return {
    gameId,
    visibleTools,
    primaryStarter,
    primaryToolId,
    isPrimaryRunning,
    exclusiveRunning,
    isToolRunning,
    startTool,
    handlePlay,
  };
};
