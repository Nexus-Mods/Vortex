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

// eslint-disable-next-line vortex/no-module-imports
import * as path from 'path';

import type { IResolver, IResolverRegistry, SerializedFilePath } from './IResolver';
import type { Anchor, RelativePath, ResolvedPath } from './types';

import { RelativePath as RelativePathNS, Anchor as AnchorNS, ResolvedPath as ResolvedPathNS } from './types';

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

  // ========================================================================
  // Reverse Resolution Helpers
  // ========================================================================

  /**
   * Get relative path from this FilePath to a child OS path
   *
   * @param childPath - Absolute OS path that should be under this FilePath
   * @returns Relative path from this FilePath to the child, or null if not under
   *
   * @example
   * ```typescript
   * const parent = resolver.PathFor('userData', 'mods');
   * const childPath = 'C:\\...\\Vortex\\mods\\SkyUI\\interface\\skyui.swf';
   * const relative = await parent.relativeTo(childPath);
   * // → RelativePath('SkyUI/interface/skyui.swf')
   *
   * // To get the child as a FilePath:
   * const child = parent.join(relative);
   * ```
   */
  async relativeTo(childPath: string | ResolvedPath): Promise<RelativePath | null> {
    // Resolve this FilePath to get the parent OS path
    const parentPath = await this.resolve();

    // Normalize for comparison
    const normalizedParent = path.normalize(parentPath as string);
    const normalizedChild = path.normalize(childPath as string);

    // Check if child is under parent (case-insensitive on Windows)
    const parentLower = process.platform === 'win32'
      ? normalizedParent.toLowerCase()
      : normalizedParent;
    const childLower = process.platform === 'win32'
      ? normalizedChild.toLowerCase()
      : normalizedChild;

    const parentWithSep = parentLower.endsWith(path.sep)
      ? parentLower
      : parentLower + path.sep;

    if (!childLower.startsWith(parentWithSep) && childLower !== parentLower) {
      return null; // Child is not under parent
    }

    // Extract relative path
    const relative = path.relative(normalizedParent, normalizedChild);
    const normalized = relative.replace(/\\/g, '/'); // Forward slashes

    return normalized === '' ? RelativePathNS.EMPTY : RelativePathNS.make(normalized);
  }

  /**
   * Replace the base (anchor + base relative path) while preserving relative structure
   *
   * @param newBase - FilePath to use as new base
   * @returns New FilePath with replaced base
   *
   * @example
   * ```typescript
   * const original = gameResolver.PathFor('skyrim', 'Data/Meshes/armor.nif');
   * const backup = vortexResolver.PathFor('userData', 'backups/skyrim-backup');
   * const moved = original.withBase(backup);
   * // → FilePath('userData', 'backups/skyrim-backup/Data/Meshes/armor.nif')
   * ```
   */
  withBase(newBase: FilePath): FilePath {
    // Combine new base's relative path with this path's relative path
    const combinedRelative = RelativePathNS.join(newBase.getRelativePath(), this.relative);

    return new FilePath(combinedRelative, newBase.getAnchor(), newBase.getResolver());
  }

  /**
   * Check if this path is an ancestor of another path
   *
   * @param childPath - Absolute OS path to check
   * @returns True if childPath is under this FilePath
   *
   * @example
   * ```typescript
   * const mods = resolver.PathFor('userData', 'mods');
   * const skyuiPath = 'C:\\...\\Vortex\\mods\\SkyUI\\skyui.esp';
   * await mods.isAncestorOf(skyuiPath); // → true
   * ```
   */
  async isAncestorOf(childPath: string | ResolvedPath): Promise<boolean> {
    const relative = await this.relativeTo(childPath);
    return relative !== null;
  }

  /**
   * Get the anchor for this FilePath (for reverse resolution use cases)
   *
   * @returns The anchor
   */
  getAnchor(): Anchor {
    return this.anchor;
  }

  /**
   * Get the resolver for this FilePath
   *
   * @returns The resolver
   */
  getResolver(): IResolver {
    return this.resolver;
  }

  /**
   * Get the relative path component
   *
   * @returns The relative path
   */
  getRelativePath(): RelativePath {
    return this.relative;
  }
}
