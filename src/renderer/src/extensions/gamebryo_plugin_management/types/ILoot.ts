import type { ForkFunction, LogCallback, LootAsync, PluginInterface, PluginMetadata } from "loot";

/** The edge kinds libloot reports on a getGroupsPath vertex. */
export enum EdgeType {
  userGroup = "userGroup",
  masterlistGroup = "masterlistGroup",
  hardcoded = "hardcoded",
  master = "master",
  masterFlag = "masterFlag",
  masterlistLoadAfter = "masterlistLoadAfter",
  masterlistRequirement = "masterlistRequirement",
  userLoadAfter = "userlistLoadAfter",
  userRequirement = "userlistRequirement",
  assetOverlap = "assetOverlap",
  recordOverlap = "recordOverlap",
  tieBreak = "tieBreak",
}

/** loot's Vertex with the edge kind refined to the known EdgeType values. */
export interface ICycleEdge {
  name: string;
  typeOfEdgeToNextVertex: EdgeType;
}

/**
 * The members driven on a Bluebird.promisifyAll'd LootAsync instance. The *Async members are
 * generated at runtime, so node-loot's index.d.ts cannot supply them (and mis-declares parts
 * of the callback surface it does have - loadPlugins/getPlugin/getGroupsPath as synchronous,
 * isClosed missing); only the payload types come from it.
 * TODO LAZ-1068: fix index.d.ts upstream in Nexus-Mods/node-loot so this member list can be
 * derived.
 */
export interface ILootProm {
  clearConditionCacheAsync: () => Promise<void>;
  close: () => void;
  getGroupsPathAsync: (fromGroupName: string, toGroupName: string) => Promise<ICycleEdge[]>;
  getPluginAsync: (pluginName: string) => Promise<PluginInterface | undefined>;
  getPluginMetadataAsync: (pluginName: string) => Promise<PluginMetadata | undefined>;
  isClosed: () => boolean;
  loadCurrentLoadOrderStateAsync: () => Promise<void>;
  loadListsAsync: (
    masterlistPath: string,
    userlistPath: string,
    preludePath: string,
  ) => Promise<void>;
  loadPluginsAsync: (pluginNames: string[], loadHeadersOnly: boolean) => Promise<void>;
  sortPluginsAsync: (pluginNames: string[]) => Promise<string[]>;
}

/** The promisifyAll'd LootAsync constructor; createAsync is the only static in use. */
export interface ILootStaticProm {
  createAsync: (
    gameId: string,
    gamePath: string,
    gameLocalPath: string,
    language: string,
    logCallback: LogCallback,
    onFork: ForkFunction,
  ) => Promise<LootAsync>;
}

/**
 * The loot instance for the active game; both fields stay undefined until the first init, and
 * loot stays undefined when init failed or the game has no loot support.
 */
export interface ILootRef {
  game: string | undefined;
  loot: ILootProm | undefined;
}
