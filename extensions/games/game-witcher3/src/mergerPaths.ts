import path from "node:path";

/** Directory the script merger is installed into, relative to the game root. */
export const MERGER_RELPATH = "WitcherScriptMerger";

const normalise = (input: string) =>
  path
    .normalize(input)
    .replace(/[\\/]+$/, "")
    .toLowerCase();

/**
 * Whether a path sits inside the given root. Every edition shares one game
 * entry, so a stored tool path can belong to a different install than the one
 * discovered; existing on disk is not enough to make it the right one.
 */
export function isPathWithinRoot(candidate: string | undefined, root: string | undefined): boolean {
  if (candidate === undefined || root === undefined) {
    return false;
  }
  const normalisedRoot = normalise(root);
  const normalisedCandidate = normalise(candidate);
  return (
    normalisedCandidate === normalisedRoot ||
    normalisedCandidate.startsWith(normalisedRoot + path.sep)
  );
}

/** Where the merger belongs for a given game root. */
export function mergerDirForRoot(gameRoot: string): string {
  return path.join(gameRoot, MERGER_RELPATH);
}

/**
 * The merger keeps its merge state beside its exe and compiles against one
 * install's vanilla scripts, so each game root needs its own copy.
 */
export function isMergerToolValidForRoot(
  toolPath: string | undefined,
  gameRoot: string | undefined,
): boolean {
  return isPathWithinRoot(toolPath, gameRoot);
}
