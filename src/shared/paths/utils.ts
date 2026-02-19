/**
 * Utility functions for path operations
 *
 * Provides standalone utilities that don't require a registry,
 * including reverse resolution and path matching helpers.
 */

import { FilePath } from './FilePath';
import type { IResolver } from './IResolver';
import type { ResolvedPath } from './types';

/**
 * Reverse resolve an OS path to a FilePath by trying resolvers in order
 *
 * Attempts to convert an absolute OS path back to a FilePath by trying
 * each resolver in the provided array. The first resolver that can handle
 * the path wins.
 *
 * @param resolvedPath - OS path to convert
 * @param resolvers - Array of resolvers to try, in priority order
 * @returns FilePath if any resolver can handle it, null otherwise
 *
 * @example
 * ```typescript
 * const vortex = new VortexResolver();
 * const unix = new UnixResolver();
 *
 * // Try vortex first, then unix
 * const path = ResolvedPath.make('/home/user/.vortex/userData/mods/skyrim.esp');
 * const result = await reverseResolve(path, [vortex, unix]);
 * // → FilePath with anchor='userData', relative='mods/skyrim.esp'
 *
 * // Priority matters - more specific resolvers should come first
 * const resolvers = [gameResolver, vortexResolver, unixResolver];
 * const discovered = await reverseResolve(scannedPath, resolvers);
 * ```
 */
export async function reverseResolve(
  resolvedPath: ResolvedPath,
  resolvers: IResolver[]
): Promise<FilePath | null> {
  for (const resolver of resolvers) {
    const result = await resolver.tryReverse(resolvedPath);
    if (result) {
      return new FilePath(result.relative, result.anchor, resolver);
    }
  }
  return null;
}

/**
 * Find all resolvers that can handle this path (for debugging)
 *
 * Unlike reverseResolve which returns the first match, this function
 * tests all resolvers and returns every one that can handle the path.
 * Useful for debugging ambiguous paths or understanding resolver priority.
 *
 * @param resolvedPath - OS path to test
 * @param resolvers - Array of resolvers to test
 * @returns Array of matches with resolver and parsed components
 *
 * @example
 * ```typescript
 * const vortex = new VortexResolver();
 * const unix = new UnixResolver();
 *
 * const path = ResolvedPath.make('/home/user/.vortex/userData/mods/skyrim.esp');
 * const matches = await findAllMatches(path, [vortex, unix]);
 *
 * // Both resolvers might match - helps debug priority issues
 * matches.forEach(match => {
 *   console.log(`${match.resolver.name}: ${match.anchor} / ${match.relative}`);
 * });
 * // → vortex: userData / mods/skyrim.esp
 * // → unix: home / user/.vortex/userData/mods/skyrim.esp
 * ```
 */
export async function findAllMatches(
  resolvedPath: ResolvedPath,
  resolvers: IResolver[]
): Promise<Array<{ resolver: IResolver; filePath: FilePath }>> {
  const matches = [];
  for (const resolver of resolvers) {
    const result = await resolver.tryReverse(resolvedPath);
    if (result) {
      const filePath = new FilePath(result.relative, result.anchor, resolver);
      matches.push({ resolver, filePath });
    }
  }
  return matches;
}
