/**
 * UnixResolver - Provides a 'root' anchor for the Unix filesystem root
 *
 * Resolver for Unix-like filesystems (Linux, macOS).
 * - Single 'root' anchor that resolves to '/' (filesystem root)
 * - The filesystem implementation determines if the path is valid
 *
 * @example
 * ```typescript
 * const resolver = new UnixResolver();
 *
 * resolver.PathFor('root');              // Resolves to /
 * resolver.PathFor('root', 'home');      // Resolves to /home
 * resolver.PathFor('c');                 // ✗ TypeScript error!
 * ```
 */

import type { Anchor, ResolvedPath } from '../types';

import { Anchor as AnchorNS, ResolvedPath as ResolvedPathNS } from '../types';
import { BaseResolver } from './BaseResolver';

/**
 * Valid Unix anchor (single 'root' anchor)
 */
export type UnixAnchor = 'root';

/**
 * Unix resolver for filesystem root
 *
 * Provides a single 'root' anchor that resolves to '/' (filesystem root).
 * The filesystem implementation will determine if this path is valid on the current platform.
 *
 * @template ValidAnchors - UnixAnchor type ('root' only)
 */
export class UnixResolver extends BaseResolver<UnixAnchor> {
  constructor() {
    super('unix');
  }

  // ========================================================================
  // Anchor Support
  // ========================================================================

  canResolve(anchor: Anchor): boolean {
    const name = AnchorNS.name(anchor);
    return name === 'root';
  }

  supportedAnchors(): Anchor[] {
    return [AnchorNS.make('root')];
  }

  // ========================================================================
  // Resolution
  // ========================================================================

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async resolveAnchor(anchor: Anchor): Promise<ResolvedPath> {
    const name = AnchorNS.name(anchor);

    if (name !== 'root') {
      throw new Error(`UnixResolver only supports 'root' anchor, got: ${name}`);
    }

    // Filesystem root on Unix-like systems
    return ResolvedPathNS.make('/');
  }

  // ========================================================================
  // Type-Safe PathFor (inherited from BaseResolver)
  // ========================================================================

  /**
   * Usage examples:
   *
   * ```typescript
   * const resolver = new UnixResolver();
   *
   * // Type-safe root anchor
   * const root = resolver.PathFor('root');               // ✓ Resolves to /
   * const home = resolver.PathFor('root', 'home');       // ✓ Resolves to /home
   * const etc = resolver.PathFor('root', 'etc/passwd');  // ✓ Resolves to /etc/passwd
   *
   * // TypeScript errors for invalid anchors
   * resolver.PathFor('c');          // ✗ Not a UnixAnchor
   * resolver.PathFor('userData');   // ✗ Not a UnixAnchor
   * resolver.PathFor('drive_c');    // ✗ Not a UnixAnchor
   * ```
   */
}
