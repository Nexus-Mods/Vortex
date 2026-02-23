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

import type { IResolver } from './IResolver';
import type { Anchor, RelativePath, ResolvedPath } from './types';

import { fnv1a, RelativePath as RelativePathNS, Anchor as AnchorNS } from './types';

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
   * May require IO (e.g., resolvers that read config files).
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
  // Equality & Comparison
  // ========================================================================

  /**
   * Check if two FilePath instances are logically equal
   * (same anchor, relative path, and resolver)
   */
  equals(other: FilePath): boolean {
    return (
      this.anchor === other.anchor &&
      this.relative === other.relative &&
      this.resolver === other.resolver
    );
  }

  /**
   * FNV-1a numeric hash of the composite "resolver:anchor:relative" string
   */
  hashCode(): number {
    const anchorName = AnchorNS.name(this.anchor);
    return fnv1a(`${this.resolver.name}:${anchorName}:${this.relative}`);
  }

  /**
   * Count path segments in the relative path
   */
  depth(): number {
    return RelativePathNS.depth(this.relative);
  }

  /**
   * Check if this path is logically contained within another FilePath
   * Returns false if anchor or resolver differ.
   */
  isIn(parent: FilePath): boolean {
    if (this.anchor !== parent.anchor || this.resolver !== parent.resolver) {
      return false;
    }
    return RelativePathNS.isIn(this.relative, parent.relative);
  }

  /**
   * Compare for sorting: by resolver name, then anchor name, then relative path
   */
  compare(other: FilePath): number {
    const resolverCmp = this.resolver.name.localeCompare(other.resolver.name);
    if (resolverCmp !== 0) return resolverCmp;

    const anchorCmp = AnchorNS.name(this.anchor).localeCompare(AnchorNS.name(other.anchor));
    if (anchorCmp !== 0) return anchorCmp;

    return RelativePathNS.compare(this.relative, other.relative);
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

    // Use platform-appropriate path module for correct behavior on any host
    const fs = this.resolver.getFilesystem();
    const pathMod = fs.platform === 'win32' ? path.win32 : path.posix;

    // Normalize for comparison - resolve() properly handles . and .. segments
    const resolvedParent = pathMod.resolve(parentPath as string);
    const resolvedChild = pathMod.resolve(childPath as string);

    // Check if child is under parent (case-insensitive on Windows)
    const parentLower = fs.normalizePath(resolvedParent);
    const childLower = fs.normalizePath(resolvedChild);

    const parentWithSep = parentLower.endsWith(fs.sep)
      ? parentLower
      : parentLower + fs.sep;

    if (!childLower.startsWith(parentWithSep) && childLower !== parentLower) {
      return null; // Child is not under parent
    }

    // Extract relative path
    const relative = pathMod.relative(resolvedParent, resolvedChild);
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
    const combinedRelative = RelativePathNS.join(newBase.relative, this.relative);

    return new FilePath(combinedRelative, newBase.anchor, newBase.resolver);
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

}
