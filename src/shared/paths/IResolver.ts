/**
 * IResolver interface with type-safe anchor support
 *
 * Resolvers map anchors to concrete OS paths. They support:
 * - Type-safe anchor names via generic parameter
 * - Async resolution
 * - Introspection (canResolve, supportedAnchors)
 */

import type { FilePath } from './FilePath';
import type { IFilesystem } from './IFilesystem';
import type { Anchor, RelativePath, ResolvedPath } from './types';

/**
 * Generic resolver interface with type-safe anchor names
 *
 * @template ValidAnchors - Union of string literals representing valid anchor names
 *
 * @example
 * ```typescript
 * type AppAnchors = 'userData' | 'temp' | 'documents';
 * class AppResolver implements IResolver<AppAnchors> {
 *   PathFor<A extends AppAnchors>(anchorName: A): FilePath {
 *     // TypeScript enforces anchorName is one of: 'userData' | 'temp' | 'documents'
 *   }
 * }
 * ```
 */
export interface IResolver<ValidAnchors extends string = string> {
  /**
   * Unique name for serialization and debugging
   */
  readonly name: string;

  /**
   * Optional parent resolver for delegation
   * When this resolver cannot handle an anchor or path, it delegates to its parent
   */
  readonly parent?: IResolver;

  /**
   * Primary resolution method (async - may require IO)
   *
   * @param anchor - The anchor to resolve
   * @param relative - The relative path from the anchor
   * @returns Promise resolving to the absolute OS path
   * @throws Error if this resolver cannot handle the anchor
   */
  resolve(anchor: Anchor, relative: RelativePath): Promise<ResolvedPath>;

  /**
   * Check if this resolver (not including parent) handles this anchor
   *
   * @param anchor - The anchor to check
   * @returns true if this resolver can handle the anchor
   */
  canResolve(anchor: Anchor): boolean;

  /**
   * List all anchors supported by this resolver (not including parent)
   *
   * @returns Array of supported anchors
   */
  supportedAnchors(): Anchor[];

  /**
   * Type-safe convenience method for creating FilePath objects
   * This is a USER-REQUESTED feature for ergonomic API usage
   *
   * @template A - Anchor name (constrained to ValidAnchors)
   * @param anchorName - The anchor name (type-checked at compile time)
   * @param relative - Optional relative path from anchor
   * @returns FilePath instance configured with this resolver
   *
   * @example
   * ```typescript
   * const resolver = new AppResolver(new UnixResolver());
   *
   * // Type-safe: only accepts valid anchor names
   * resolver.PathFor('userData');        // ✓ Valid
   * resolver.PathFor('temp', 'cache');   // ✓ Valid
   * resolver.PathFor('drive_c');         // ✗ TypeScript error!
   * ```
   */
  PathFor<A extends ValidAnchors>(
    anchorName: A,
    relative?: string
  ): FilePath;

  // ========================================================================
  // Reverse Resolution
  // ========================================================================

  /**
   * Try to reverse-resolve an OS path to a FilePath
   * Returns null if this resolver (or its parent chain) cannot handle the path
   *
   * @param resolvedPath - Absolute OS path to parse
   * @returns FilePath instance, or null if not handled
   *
   * @example
   * ```typescript
   * const osPath = ResolvedPath.make('C:\\Users\\...\\AppData\\mods\\SkyUI');
   * const filePath = await appResolver.tryReverse(osPath);
   * // → FilePath with anchor='userData', relative='mods/SkyUI'
   * ```
   */
  tryReverse(resolvedPath: ResolvedPath): Promise<FilePath | null>;

  /**
   * Get the filesystem associated with this resolver chain
   * Used for path normalization and platform-specific behavior
   */
  getFilesystem(): IFilesystem;

  /**
   * Get all base paths this resolver can resolve
   * Used for efficient reverse resolution matching
   *
   * @returns Map of anchors to their resolved base paths
   *
   * @example
   * ```typescript
   * const bases = await appResolver.getBasePaths();
   * // → Map {
   * //   Anchor('userData') → 'C:\\Users\\...\\Vortex',
   * //   Anchor('temp') → 'C:\\Users\\...\\Temp',
   * //   ...
   * // }
   * ```
   */
  getBasePaths(): Promise<Map<Anchor, ResolvedPath>>;
}
