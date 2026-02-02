import { types, util } from "vortex-api";

export function toStarterInfo(
  game: types.IGameStored,
  gameDiscovery: types.IDiscoveryResult,
  tool: types.IToolStored,
  toolDiscovery: types.IDiscoveredTool,
): types.IStarterInfo {
  return new util.StarterInfo(game, gameDiscovery, tool, toolDiscovery);
}

export function starterMemoizer(
  game: types.IGameStored,
  discovery: types.IDiscoveryResult,
  tools: types.IDiscoveredTool[],
): types.IStarterInfo[] {
  const result = tools
    .filter((tool) => tool.id !== undefined)
    .map((toolDiscovery) => {
      if (toolDiscovery.hidden) {
        return undefined;
      }

      const tool = game.supportedTools.find(
        (iter) => iter.id === toolDiscovery.id,
      );
      try {
        return toStarterInfo(game, discovery, tool, toolDiscovery);
      } catch (err) {
        // not the job of this extension to report this
        return undefined;
      }
    })
    .filter((iter) => iter !== undefined);
  return result as types.IStarterInfo[];
}
