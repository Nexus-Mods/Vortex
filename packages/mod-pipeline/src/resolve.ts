import { byDestinationPath, type FileSource, type Lockfile } from "./lockfile";
import type { ResolverInput } from "./resolverInput";

/** The lockfile for a game's mods, sorted by destination. */
export function resolve(input: ResolverInput): Lockfile {
  const { gameId, install } = input;

  // later mods replace earlier ones at the same destination
  const fileByDestination = new Map<string, FileSource>();
  for (const mod of input.mods) {
    const overriddenPaths = new Set(mod.overriddenPaths);
    for (const stagedFile of mod.stagedFiles) {
      if (!overriddenPaths.has(stagedFile.destinationPath)) {
        fileByDestination.set(stagedFile.destinationPath, { ...mod.origin, ...stagedFile });
      }
    }
  }

  const files = [...fileByDestination.values()].toSorted(byDestinationPath);
  return { version: 1, gameId, install, files };
}
