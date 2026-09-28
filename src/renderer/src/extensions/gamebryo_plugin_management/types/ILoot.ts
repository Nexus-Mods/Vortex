import type { LootAsync } from "loot";

import type { ProblemSeverity } from "../../../types/ITestResult";

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

/** The path between two groups; libloot reports only EdgeType kinds on its edges. */
export async function groupsPath(
  loot: LootAsync,
  fromGroupName: string,
  toGroupName: string,
): Promise<ICycleEdge[]> {
  return (await loot.getGroupsPath(fromGroupName, toGroupName)) as ICycleEdge[];
}

/** A loot failure in the user's words. The raw error goes to the log, never in here. */
export interface ILootFailure {
  // error when the plugin list or Vortex is at fault, warning for state the user can fix; a
  // failure that leaves the load order as it was is never fatal
  severity: Exclude<ProblemSeverity, "fatal">;
  // the reason, phrased to follow "Plugins not sorted because:"
  message: string;
}

/**
 * The loot instance for the active game; both fields stay undefined until the first init, and
 * loot stays undefined when init failed or the game has no loot support.
 */
export interface ILootRef {
  game: string | undefined;
  loot: LootAsync | undefined;
}
