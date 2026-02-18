/**
 * FilePath class - Core path type with deferred resolution
 *
 * Combines RelativePath + Anchor + IResolver into a single object that defers
 * resolution until the last moment. Paths stay logical until resolve() is called.
 *
 * @example
 * ```typescript
 * const filePath = resolver.PathFor('userData', 'mods/skyrim');
 * const resolved = await filePath.resolve(); // C:\Users\...\mods\skyrim
 * ```
 */

import type { IResolver, IResolverRegistry, SerializedFilePath } from './IResolver';
import type { Anchor, RelativePath, ResolvedPath } from './types';

import { RelativePath as RelativePathNS, Anchor as AnchorNS } from './types';

/**
 * FilePath combines a RelativePath, an Anchor, and a IResolver
 *
 * Resolution is deferred - the path stays logical until resolve() is called.
 * All builder methods return new immutable instances.
 */
export class FilePath {
  /**
   * Create a new FilePath
   *
   * @param relative - The relative path from the anchor
   * @param anchor - The anchor (resolution starting point)
   * @param resolver - The resolver to use for resolution
   */
  constructor(
    public readonly relative: RelativePath,
    public readonly anchor: Anchor,
    public readonly resolver: IResolver,
  ) {
    // Validate that the resolver can handle this anchor
    if (!resolver.canResolve(anchor)) {
      throw new Error(
        `Resolver "${resolver.name}" cannot handle anchor: ${AnchorNS.name(anchor)}`
      );
    }
  }

  // ========================================================================
  // Resolution
  // ========================================================================

  /**
   * Async resolution to ResolvedPath
   *
   * Resolves the anchor + relative path to a concrete OS path.
   * May require IO (e.g., ProtonResolver needs to read config files).
   *
   * @returns Promise resolving to absolute OS path
   * @throws Error if no resolver in the chain can handle this anchor
   *
   * @example
   * ```typescript
   * const filePath = resolver.PathFor('userData', 'mods');
   * const resolved = await filePath.resolve();
   * console.log(resolved); // C:\Users\...\AppData\Roaming\Vortex\mods
   * ```
   */
  async resolve(): Promise<ResolvedPath> {
    return this.resolver.resolve(this.anchor, this.relative);
  }

  // ========================================================================
  // Builder Methods (return new FilePath)
  // ========================================================================

  /**
   * Join path segments to this path
   * Returns a new FilePath with extended relative path
   *
   * @param segments - Path segments to join
   * @returns New FilePath with joined path
   *
   * @example
   * ```typescript
   * const mods = resolver.PathFor('userData', 'mods');
   * const skyrim = mods.join('skyrim', 'data');
   * // skyrim.relative === 'mods/skyrim/data'
   * ```
   */
  join(...segments: string[]): FilePath {
    const newRelative = RelativePathNS.join(this.relative, ...segments);
    return new FilePath(newRelative, this.anchor, this.resolver);
  }

  /**
   * Create a new FilePath with a different resolver
   *
   * @param newResolver - The new resolver to use
   * @returns New FilePath with the new resolver
   *
   * @example
   * ```typescript
   * const path = vortexResolver.PathFor('userData', 'mods');
   * const withProton = path.withResolver(protonResolver);
   * // Same anchor and relative path, but different resolver
   * ```
   */
  withResolver(newResolver: IResolver): FilePath {
    return new FilePath(this.relative, this.anchor, newResolver);
  }

  /**
   * Create a new FilePath with a different anchor
   *
   * @param newAnchor - The new anchor to use
   * @returns New FilePath with the new anchor
   * @throws Error if the resolver can't handle the new anchor
   *
   * @example
   * ```typescript
   * const userData = resolver.PathFor('userData', 'mods');
   * const temp = userData.withAnchor(Anchor.make('temp'));
   * // Same relative path and resolver, but different anchor
   * ```
   */
  withAnchor(newAnchor: Anchor): FilePath {
    return new FilePath(this.relative, newAnchor, this.resolver);
  }

  /**
   * Create a new FilePath with a different relative path
   *
   * @param newRelative - The new relative path
   * @returns New FilePath with the new relative path
   *
   * @example
   * ```typescript
   * const mods = resolver.PathFor('userData', 'mods');
   * const downloads = mods.withRelative(RelativePath.make('downloads'));
   * // Same anchor and resolver, but different relative path
   * ```
   */
  withRelative(newRelative: RelativePath): FilePath {
    return new FilePath(newRelative, this.anchor, this.resolver);
  }

  /**
   * Get the parent directory as a new FilePath
   *
   * @returns New FilePath pointing to parent directory
   *
   * @example
   * ```typescript
   * const file = resolver.PathFor('userData', 'mods/skyrim/data.esp');
   * const dir = file.parent();
   * // dir.relative === 'mods/skyrim'
   * ```
   */
  parent(): FilePath {
    const parentRelative = RelativePathNS.dirname(this.relative);
    return new FilePath(parentRelative, this.anchor, this.resolver);
  }

  /**
   * Get the basename (filename) of this path
   *
   * @param ext - Optional extension to remove
   * @returns Filename as string
   *
   * @example
   * ```typescript
   * const file = resolver.PathFor('userData', 'mods/skyrim/data.esp');
   * file.basename(); // 'data.esp'
   * file.basename('.esp'); // 'data'
   * ```
   */
  basename(ext?: string): string {
    return RelativePathNS.basename(this.relative, ext);
  }

  // ========================================================================
  // Serialization
  // ========================================================================

  /**
   * Serialize to JSON for IPC or Redux storage
   *
   * @returns Serializable object with relative, anchor, resolverName
   *
   * @example
   * ```typescript
   * const filePath = resolver.PathFor('userData', 'mods');
   * const json = filePath.toJSON();
   * // { relative: 'mods', anchor: 'userData', resolverName: 'vortex' }
   * ```
   */
  toJSON(): SerializedFilePath {
    return {
      relative: this.relative as string,
      anchor: AnchorNS.name(this.anchor),
      resolverName: this.resolver.name,
    };
  }

  /**
   * Deserialize from JSON (requires resolver registry)
   *
   * @param json - Serialized FilePath
   * @param registry - Resolver registry to look up resolver by name
   * @returns New FilePath instance
   * @throws Error if resolver not found in registry
   *
   * @example
   * ```typescript
   * const json = { relative: 'mods', anchor: 'userData', resolverName: 'vortex' };
   * const filePath = FilePath.fromJSON(json, globalResolverRegistry);
   * ```
   */
  static fromJSON(json: SerializedFilePath, registry: IResolverRegistry): FilePath {
    const resolver = registry.getOrThrow(json.resolverName);
    const relative = RelativePathNS.make(json.relative);
    const anchor = AnchorNS.make(json.anchor);
    return new FilePath(relative, anchor, resolver);
  }

  // ========================================================================
  // Debugging
  // ========================================================================

  /**
   * Convert to string for debugging
   *
   * @returns Debug string representation
   *
   * @example
   * ```typescript
   * const filePath = resolver.PathFor('userData', 'mods/skyrim');
   * console.log(filePath.toString());
   * // "FilePath[userData]/mods/skyrim (vortex)"
   * ```
   */
  toString(): string {
    const anchorName = AnchorNS.name(this.anchor);
    const relativePath = this.relative || '(root)';
    return `FilePath[${anchorName}]/${relativePath} (${this.resolver.name})`;
  }

  /**
   * For console.log debugging
   */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return this.toString();
  }

  // ========================================================================
  // Equality
  // ========================================================================

  /**
   * Check if two FilePath instances are logically equal
   * (same anchor, relative path, and resolver)
   *
   * @param other - Other FilePath to compare
   * @returns true if equal
   *
   * @example
   * ```typescript
   * const path1 = resolver.PathFor('userData', 'mods');
   * const path2 = resolver.PathFor('userData', 'mods');
   * path1.equals(path2); // true
   * ```
   */
  equals(other: FilePath): boolean {
    return (
      this.anchor === other.anchor &&
      this.relative === other.relative &&
      this.resolver === other.resolver
    );
  }

  /**
   * Create a hash code for this FilePath (useful for Maps/Sets)
   *
   * @returns Hash code string
   */
  hashCode(): string {
    const anchorName = AnchorNS.name(this.anchor);
    return `${this.resolver.name}:${anchorName}:${this.relative}`;
  }
}
