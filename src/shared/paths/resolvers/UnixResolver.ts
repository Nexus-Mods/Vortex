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

import type { IFilesystem } from '../IFilesystem';
import type { IResolver } from '../IResolver';
import type { ResolvedPath } from '../types';

import { ResolvedPath as ResolvedPathNS } from '../types';
import { MappingResolver, fromFunction, type MappingStrategy } from './MappingResolver';

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
export class UnixResolver extends MappingResolver<UnixAnchor> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(parent?: IResolver<any>, filesystem?: IFilesystem) {
    super('unix', parent, filesystem);
  }

  // ========================================================================
  // Mapping Strategy
  // ========================================================================

  protected getStrategy(): MappingStrategy<UnixAnchor> {
    return fromFunction(
      ['root'] as const,
      () => ResolvedPathNS.make('/')
    );
  }

  // ========================================================================
  // OS Path Conversion (Terminal Resolver)
  // ========================================================================

  protected toOSPath(intermediatePath: ResolvedPath): ResolvedPath {
    return intermediatePath;  // Unix paths are already valid OS paths
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
