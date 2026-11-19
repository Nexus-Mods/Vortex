import { lockfileFiles, type FileEntry, type FileSource, type Lockfile } from "./lockfile";
import { pathKeyOf } from "./pathKey";
import type { ResolverInput, ResolverMod } from "./resolverInput";

/** A mod's staged files at the destinations it does not override. */
export function deployingFiles(mod: ResolverMod): FileEntry[] {
  const overriddenPaths = new Set(mod.overriddenPaths.map(pathKeyOf));
  return mod.stagedFiles.filter(
    (stagedFile) => !overriddenPaths.has(pathKeyOf(stagedFile.destinationPath)),
  );
}

/** The lockfile for a game's mods, sorted by destination. */
export function resolve(input: ResolverInput): Lockfile {
  const { gameId, install } = input;

  // later mods replace earlier ones at the same destination
  const files: FileSource[] = [];
  for (const mod of input.mods) {
    for (const stagedFile of deployingFiles(mod)) {
      files.push({ ...mod.origin, ...stagedFile });
    }
  }
  return { version: 1, gameId, install, files: lockfileFiles(files) };
}
