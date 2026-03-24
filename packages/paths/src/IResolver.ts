/**
 * IResolver interfaces with type-safe anchor support
 *
 * Resolvers map anchors to concrete OS paths. They support:
 * - Type-safe anchor names via generic parameter
 * - Async resolution
 * - Introspection (canResolve, supportedAnchors)
 *
 * Two interfaces are provided:
 * - `IResolverBase` — non-generic, used for parent references and anywhere
 *   the anchor type parameter is irrelevant (e.g., FilePath.resolver)
 * - `IResolver<ValidAnchors>` — adds the generic `PathFor` method for
 *   type-safe anchor name checking at compile time
 */

import type { FilePath } from "./FilePath";
import type { IFilesystem } from "./IFilesystem";
import type { Anchor, RelativePath, ResolvedPath } from "./types";

/**
 * Non-generic resolver interface for resolver chain plumbing
 *
 * Contains all resolver methods except `PathFor`. Used for:
 * - Parent references (`parent?: IResolverBase`)
 * - `FilePath.resolver` (only calls resolve/canResolve/getFilesystem)
 * - Any context where the anchor type parameter is irrelevant
 *
 * Separated from `IResolver<ValidAnchors>` because `PathFor`'s generic
 * parameter is contravariant — `IResolver<'root'>` is not assignable to
 * `IResolver<string>` even though it's a valid resolver. `IResolverBase`
 * avoids this issue entirely.
 */
export interface IResolverBase {
  /**
   * Unique name for serialization and debugging
   */
  readonly name: string;

  /**
   * Optional parent resolver for the resolver chain.
   * Used by `toOSPath()` to walk up to a terminal resolver and by
   * `getFilesystem()` to find the chain's filesystem. Parent delegation
   * does NOT apply to forward `resolve()` or `tryReverse()`.
   */
  readonly parent?: IResolverBase;

  /**
   * Resolve an anchor + relative path to an absolute OS path.
   *
   * Only resolves anchors this resolver understands (checked via `canResolve`).
   * Unknown anchors throw immediately — there is no parent delegation.
   *
   * Returns a Promise to support a planned feature: **case normalization** —
   * reading the filesystem to determine the true casing of path segments
   * (e.g., `"program files"` → `"Program Files"` on Windows). This requires
   * async I/O, so the signature is async even though current implementations
   * don't need it.
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
   * Try to reverse-resolve an OS path to a FilePath using only this resolver's
   * own anchors. Does not delegate to parent. Returns null if this resolver
   * cannot handle the path.
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

/**
 * Generic resolver interface with type-safe anchor names
 *
 * Extends `IResolverBase` with `PathFor` — a type-safe convenience method
 * that constrains anchor names at compile time.
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
export interface IResolver<
  ValidAnchors extends string = string,
> extends IResolverBase {
  /**
   * Type-safe convenience method for creating FilePath objects
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
  PathFor<A extends ValidAnchors>(anchorName: A, relative?: string): FilePath;
}
