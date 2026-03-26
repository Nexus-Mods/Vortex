import path from "path";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";

import type { IStarterInfo } from "../../../util/StarterInfo";
import type { IDiscoveryResult, IGameStored } from "../../../types/IState";

import * as fs from "../../../util/fs";
import { activeGameId } from "../../../util/selectors";
import StarterInfo from "../../../util/StarterInfo";
import { getSafe } from "../../../util/storeHelper";
import { truthy } from "../../../util/util";
import { updateJumpList } from "../../../extensions/starter_dashlet/util";
import { generateGameStarter, generateToolStarters } from "./toolStarters";

const MAX_PINNED_TOOLS = 5;

const emptyObj = {};
const emptyArray: string[] = [];

async function validateTools(
  starters: IStarterInfo[],
  discoveryPath: string,
): Promise<string[]> {
  const validIds: string[] = [];
  for (const starter of starters) {
    if (!starter?.exePath) continue;
    const exePath = path.isAbsolute(starter.exePath)
      ? starter.exePath
      : path.join(discoveryPath, starter.exePath);
    try {
      await fs.statAsync(exePath);
      validIds.push(starter.id);
    } catch {
      // tool exe not found - not valid
    }
  }
  return validIds;
}

export const useToolsData = () => {
  // ── Redux selectors ─────────────────────────────────────────────────────
  const gameMode = useSelector(activeGameId);
  const knownGames = useSelector(
    (s: any) => s.session.gameMode.known as IGameStored[],
  );
  const discoveredGames = useSelector(
    (s: any) =>
      s.settings.gameMode.discovered as Record<string, IDiscoveryResult>,
  );
  const discoveredTools = useSelector((s: any) =>
    getSafe(
      s,
      ["settings", "gameMode", "discovered", gameMode, "tools"],
      emptyObj,
    ),
  );
  const toolsOrder = useSelector((s: any) =>
    getSafe(
      s,
      ["settings", "interface", "tools", "order", gameMode],
      emptyArray,
    ),
  );
  const primaryTool = useSelector((s: any) =>
    getSafe(s, ["settings", "interface", "primaryTool", gameMode], undefined),
  );
  const toolsRunning = useSelector((s: any) => s.session.base.toolsRunning);
  const mods = useSelector((s: any) =>
    getSafe(s, ["persistent", "mods", gameMode], emptyObj),
  );
  const deploymentCounter = useSelector(
    (s: any) => s.persistent?.deployment?.deploymentCounter?.[gameMode] ?? 0,
  );

  // ── Tool generation & validation ────────────────────────────────────────
  const [tools, setTools] = useState<IStarterInfo[]>([]);
  const [validToolIds, setValidToolIds] = useState<string[]>([]);

  const refreshTools = useCallback(() => {
    const gameStarter = generateGameStarter(
      knownGames,
      discoveredGames,
      gameMode,
    );
    const newTools = generateToolStarters(
      knownGames,
      discoveredGames,
      discoveredTools,
      toolsOrder,
      gameMode,
      gameStarter?.id,
    );
    setTools(newTools);
    const jumpList = truthy(gameStarter)
      ? [gameStarter].concat(newTools)
      : newTools;
    updateJumpList(jumpList);
    return newTools;
  }, [knownGames, discoveredGames, discoveredTools, toolsOrder, gameMode]);

  useEffect(() => {
    refreshTools();
  }, []);

  useEffect(() => {
    const newTools = refreshTools();
    const discoveryPath = discoveredGames[gameMode]?.path;
    if (discoveryPath !== undefined) {
      validateTools(newTools, discoveryPath).then(setValidToolIds);
    }
  }, [
    discoveredGames,
    gameMode,
    knownGames,
    toolsOrder,
    mods,
    deploymentCounter,
  ]);

  // ── Derived: pinned / unpinned / launcher split ─────────────────────────

  const isToolHidden = useCallback(
    (starter: IStarterInfo) =>
      discoveredTools[starter.id]?.hidden === true,
    [discoveredTools],
  );

  const { launcherTool, otherPinnedTools, unpinnedTools } = useMemo(() => {
    const launcher = tools.find((s) => s.id === primaryTool);
    const nonLauncher = tools.filter((s) => s.id !== primaryTool);

    // Pinned = not explicitly hidden. Unpinned = explicitly hidden.
    // Tools without a hidden flag default to pinned.
    const pinned = nonLauncher.filter(
      (s) =>
        s.isGame ||
        discoveredTools[s.id] === undefined ||
        !isToolHidden(s),
    );
    const unpinned = nonLauncher.filter(
      (s) => !s.isGame && isToolHidden(s),
    );

    return {
      launcherTool: launcher,
      otherPinnedTools: pinned,
      unpinnedTools: unpinned,
    };
  }, [tools, primaryTool, discoveredTools, isToolHidden]);

  const pinnedCount = otherPinnedTools.length;
  const maxPinnedReached = pinnedCount >= MAX_PINNED_TOOLS;

  const isToolValid = useCallback(
    (starter: IStarterInfo) => validToolIds.includes(starter.id),
    [validToolIds],
  );

  const isToolRunning = useCallback(
    (starter: IStarterInfo) => {
      const starterInfo = starter as StarterInfo;
      return (
        starterInfo?.exePath !== undefined &&
        toolsRunning[starterInfo.exePath] !== undefined
      );
    },
    [toolsRunning],
  );

  return {
    gameMode,
    tools,
    toolsOrder,
    knownGames,
    discoveredGames,
    discoveredTools,
    primaryTool,
    launcherTool,
    otherPinnedTools,
    unpinnedTools,
    pinnedCount,
    maxPinnedReached,
    MAX_PINNED_TOOLS,
    isToolValid,
    isToolRunning,
    isToolHidden,
  };
};
