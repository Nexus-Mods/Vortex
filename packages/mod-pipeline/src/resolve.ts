import { lockfileFiles, type FileSource, type Lockfile } from "./lockfile";
import { pathKeyOf } from "./pathKey";
import type { ResolverInput } from "./resolverInput";

/** The lockfile for a game's mods, sorted by destination. */
export function resolve(input: ResolverInput): Lockfile {
  const { gameId, install } = input;

  // later mods replace earlier ones at the same destination
  const files: FileSource[] = [];
  for (const mod of input.mods) {
    const overriddenPaths = new Set(mod.overriddenPaths.map(pathKeyOf));
    for (const stagedFile of mod.stagedFiles) {
      if (!overriddenPaths.has(pathKeyOf(stagedFile.destinationPath))) {
        files.push({ ...mod.origin, ...stagedFile });
      }
    }
  }
  return { version: 1, gameId, install, files: lockfileFiles(files) };
}
