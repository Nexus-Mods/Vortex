/**
 * GameResolver - Resolves game-specific anchors using a path mapping
 *
 * Provides type-safe access to game installation paths via simple hashmap lookup.
 */

import type { FilePath } from '../FilePath';
import type { Anchor, ResolvedPath } from '../types';

import { Anchor as AnchorNS } from '../types';
import { BaseResolver } from './BaseResolver';

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
export class GameResolver extends BaseResolver<string> {
  constructor(
    private readonly gamePaths: Map<string, FilePath>,
  ) {
    super('game');
  }

  // ========================================================================
  // Anchor Support
  // ========================================================================

  canResolve(anchor: Anchor): boolean {
    const name = AnchorNS.name(anchor);
    return this.gamePaths.has(name);
  }

  supportedAnchors(): Anchor[] {
    return Array.from(this.gamePaths.keys()).map(AnchorNS.make);
  }

  // ========================================================================
  // Resolution
  // ========================================================================

  protected async resolveAnchor(anchor: Anchor): Promise<ResolvedPath> {
    const name = AnchorNS.name(anchor);
    const filePath = this.gamePaths.get(name);

    if (!filePath) {
      throw new Error(`Unknown game anchor: ${name}`);
    }

    return filePath.resolve();
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
