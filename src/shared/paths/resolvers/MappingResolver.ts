/**
 * MappingResolver - Base class for resolvers that map anchor names to paths
 *
 * Provides a common pattern for resolvers that:
 * 1. Map an anchor name (string) to a base path
 * 2. Join the base path with a relative path
 * 3. Return a ResolvedPath
 *
 * This pattern is shared by:
 * - VortexResolver (static record lookup)
 * - GameResolver (dynamic Map lookup)
 * - ProtonResolver (computed with async IO)
 * - WindowsResolver (computed, simple)
 * - UnixResolver (computed, trivial)
 *
 * By extracting this pattern, we reduce duplication and make
 * the mapping strategy explicit.
 */

import type { FilePath } from '../FilePath';
import type { Anchor, ResolvedPath } from '../types';

import { Anchor as AnchorNS, ResolvedPath as ResolvedPathNS } from '../types';
import { BaseResolver } from './BaseResolver';

/**
 * Strategy interface for mapping anchors to paths
 *
 * Defines how a resolver maps anchor names to resolved paths.
 * Three helper functions (fromRecord, fromMap, fromFunction) cover
 * the most common use cases.
 */
export type MappingStrategy<ValidAnchors extends string> = {
  /**
   * Check if this strategy can resolve the given anchor name
   */
  canResolve(anchorName: ValidAnchors): boolean;

  /**
   * List all anchor names supported by this strategy
   */
  supportedAnchors(): ValidAnchors[];

  /**
   * Resolve anchor name to base path (async)
   */
  resolve(anchorName: ValidAnchors): Promise<ResolvedPath>;
};

/**
 * Abstract base class for resolvers using the mapping pattern
 *
 * Subclasses implement getStrategy() to provide their mapping logic.
 * The base class handles:
 * - Anchor validation
 * - Strategy caching
 * - Error messages
 *
 * @template ValidAnchors - Union of string literals for valid anchor names
 *
 * @example
 * ```typescript
 * class UnixResolver extends MappingResolver<'root'> {
 *   protected getStrategy(): MappingStrategy<'root'> {
 *     return fromFunction(
 *       ['root'] as const,
 *       () => ResolvedPathNS.make('/')
 *     );
 *   }
 * }
 * ```
 */
export abstract class MappingResolver<ValidAnchors extends string>
  extends BaseResolver<ValidAnchors> {

  /**
   * Get the mapping strategy for this resolver
   *
   * Called once and cached. Subclasses implement this to provide
   * their specific mapping logic.
   */
  protected abstract getStrategy(): MappingStrategy<ValidAnchors>;

  private strategyCache?: MappingStrategy<ValidAnchors>;

  /**
   * Get cached strategy (creates on first access)
   */
  private get strategy(): MappingStrategy<ValidAnchors> {
    if (!this.strategyCache) {
      this.strategyCache = this.getStrategy();
    }
    return this.strategyCache;
  }

  // ========================================================================
  // BaseResolver Implementation
  // ========================================================================

  canResolve(anchor: Anchor): boolean {
    const name = AnchorNS.name(anchor) as ValidAnchors;
    return this.strategy.canResolve(name);
  }

  supportedAnchors(): Anchor[] {
    return this.strategy.supportedAnchors().map(AnchorNS.make);
  }

  protected async resolveAnchor(anchor: Anchor): Promise<ResolvedPath> {
    const name = AnchorNS.name(anchor) as ValidAnchors;
    return this.strategy.resolve(name);
  }
}

// ============================================================================
// Strategy Helper Functions
// ============================================================================

/**
 * Create strategy from static record (for compile-time known mappings)
 *
 * Use this when you have a fixed set of anchors that map to paths or values.
 * Optionally provide a transform function to convert values to ResolvedPath.
 *
 * @template K - Union of string literals for anchor names
 * @template V - Type of values in record (ResolvedPath or string or custom)
 * @param record - Static record of anchor names to values
 * @param transform - Optional function to convert values to ResolvedPath
 * @returns MappingStrategy that looks up values in the record
 *
 * @example
 * ```typescript
 * // Simple string-to-path mapping
 * fromRecord({
 *   userData: '/home/user/.vortex',
 *   temp: '/tmp/vortex'
 * })
 *
 * // With transform function
 * fromRecord(
 *   { userData: 'userData', temp: 'temp' },
 *   (appPath) => ResolvedPathNS.make(getVortexPath(appPath))
 * )
 * ```
 */
export function fromRecord<K extends string, V extends ResolvedPath | string>(
  record: Record<K, V>,
  transform?: (value: V) => Promise<ResolvedPath> | ResolvedPath
): MappingStrategy<K> {
  return {
    canResolve: (name) => name in record,
    supportedAnchors: () => Object.keys(record) as K[],
    resolve: async (name) => {
      const value = record[name];
      if (!value) {
        throw new Error(`Unknown anchor: ${name}`);
      }
      if (transform) {
        return transform(value);
      }
      return typeof value === 'string' ? ResolvedPathNS.make(value) : value;
    },
  };
}

/**
 * Create strategy from Map (for runtime-populated mappings)
 *
 * Use this when the set of anchors is determined at runtime, such as
 * for game paths that are discovered dynamically.
 *
 * @template K - Union of string literals for anchor names
 * @param map - Map from anchor names to FilePath instances
 * @returns MappingStrategy that looks up values in the map
 *
 * @example
 * ```typescript
 * const gamePaths = new Map<string, FilePath>();
 * gamePaths.set('skyrim', vortex.PathFor('userData', 'games/skyrim'));
 * gamePaths.set('fallout4', vortex.PathFor('userData', 'games/fallout4'));
 *
 * return fromMap(gamePaths);
 * ```
 */
export function fromMap<K extends string>(
  map: Map<K, FilePath>
): MappingStrategy<K> {
  return {
    canResolve: (name) => map.has(name),
    supportedAnchors: () => Array.from(map.keys()),
    resolve: async (name) => {
      const filePath = map.get(name);
      if (!filePath) {
        throw new Error(`Unknown anchor: ${name}`);
      }
      return filePath.resolve();
    },
  };
}

/**
 * Create strategy from function (for computed mappings)
 *
 * Use this when paths are computed on demand, such as drive letters
 * or paths that require async I/O operations.
 *
 * @template K - Union of string literals for anchor names
 * @param supportedAnchors - Array of all supported anchor names
 * @param resolveFn - Function to compute path for an anchor name
 * @returns MappingStrategy that computes values using the function
 *
 * @example
 * ```typescript
 * // Simple synchronous computation
 * fromFunction(
 *   ['root'] as const,
 *   () => ResolvedPathNS.make('/')
 * )
 *
 * // Async computation with I/O
 * fromFunction(
 *   ['drive_c', 'documents'] as const,
 *   async (name) => {
 *     const protonInfo = await getProtonInfo();
 *     return computePath(protonInfo, name);
 *   }
 * )
 * ```
 */
export function fromFunction<K extends string>(
  supportedAnchors: readonly K[],
  resolveFn: (anchorName: K) => Promise<ResolvedPath> | ResolvedPath
): MappingStrategy<K> {
  const anchorSet = new Set(supportedAnchors);

  return {
    canResolve: (name) => anchorSet.has(name),
    supportedAnchors: () => [...supportedAnchors],
    resolve: async (name) => {
      if (!anchorSet.has(name)) {
        throw new Error(`Unknown anchor: ${name}`);
      }
      return resolveFn(name);
    },
  };
}
