import type { FileSource, Lockfile } from "./lockfile";
import type { ResolverInput } from "./resolverInput";

/** The lockfile for a game's mods, sorted by destination. */
export function resolve(input: ResolverInput): Lockfile {
  const { gameId, gameVersion, storeId } = input;

  // later mods replace earlier ones at the same destination
  const fileByDestination = new Map<string, FileSource>();
  for (const mod of input.mods) {
    const overriddenPaths = new Set(mod.overriddenPaths);
    for (const { destinationPath, fileHash } of mod.stagedFiles) {
      if (!overriddenPaths.has(destinationPath)) {
        fileByDestination.set(destinationPath, { ...mod.origin, fileHash, destinationPath });
      }
    }
  }

  // destinations are unique
  const files = [...fileByDestination.values()].toSorted((lhs, rhs) =>
    lhs.destinationPath < rhs.destinationPath ? -1 : 1,
  );
  return { version: 1, gameId, gameVersion, storeId, files };
}
