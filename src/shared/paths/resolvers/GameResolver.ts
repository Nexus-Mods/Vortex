/**
 * GameResolver - Resolves game-specific anchors using a path mapping
 *
 * Provides type-safe access to game installation paths via simple hashmap lookup.
 */

import type { FilePath } from '../FilePath';

import { MappingResolver, fromMap, type MappingStrategy } from './MappingResolver';

/**
 * Resolves game-specific anchors using a simple path mapping
 * Game names are used as anchor names
 *
 * @example
 * ```typescript
 * const gamePaths = new Map<string, FilePath>();
 * gamePaths.set('skyrim', vortexResolver.PathFor('userData', 'games/skyrim'));
 * gamePaths.set('fallout4', vortexResolver.PathFor('userData', 'games/fallout4'));
 *
 * const gameResolver = new GameResolver(gamePaths);
 *
 * gameResolver.PathFor('skyrim');     // ✓ Valid
 * gameResolver.PathFor('fallout4');   // ✓ Valid
 * ```
 */
export class GameResolver extends MappingResolver<string> {
  constructor(
    private readonly gamePaths: Map<string, FilePath>,
    parent?: import('../IResolver').IResolver,
  ) {
    super('game', parent);
  }

  // ========================================================================
  // Mapping Strategy
  // ========================================================================

  protected getStrategy(): MappingStrategy<string> {
    return fromMap(this.gamePaths);
  }

  // ========================================================================
  // Type-Safe PathFor (inherited from BaseResolver)
  // ========================================================================

  /**
   * Usage examples:
   *
   * ```typescript
   * // Set up game paths
   * const gamePaths = new Map<string, FilePath>();
   * gamePaths.set('skyrim', vortexResolver.PathFor('userData', 'games/skyrim'));
   * gamePaths.set('fallout4', vortexResolver.PathFor('userData', 'games/fallout4'));
   *
   * const gameResolver = new GameResolver(gamePaths);
   *
   * // Access game paths by name
   * const skyrimPath = gameResolver.PathFor('skyrim');      // ✓
   * const fallout4Path = gameResolver.PathFor('fallout4');  // ✓
   *
   * // Resolve to absolute paths
   * const resolved = await skyrimPath.resolve();
   * ```
   */
}
