/**
 * BaseResolver - Abstract base class for all resolvers
 *
 * Provides:
 * - Generic type parameter for type-safe anchors
 * - Type-safe PathFor<A>() implementation
 * - Common resolution logic
 */

// eslint-disable-next-line vortex/no-module-imports
import * as path from 'path';

import type { IFilesystem } from '../IFilesystem';
import type { IResolver } from '../IResolver';
import type { Anchor, RelativePath, ResolvedPath } from '../types';

import { FilePath } from '../FilePath';
import { RelativePath as RelativePathNS, Anchor as AnchorNS, ResolvedPath as ResolvedPathNS } from '../types';

/**
 * Abstract base resolver with type-safe anchor support
 *
 * ## Resolution Protocol
 *
 * **Forward resolution** (`resolve`): A resolver ONLY resolves anchors it
 * understands (checked via `canResolve`). Unknown anchors throw immediately —
 * there is no parent delegation during forward resolution. After resolving an
 * anchor to an intermediate path, the result walks up the parent chain via
 * `toOSPath()` to produce a final OS path. Non-terminal resolvers (e.g.
 * MappingResolver) delegate `toOSPath()` to their parent; terminal resolvers
 * (UnixResolver, WindowsResolver) return the path as-is.
 *
 * **Reverse resolution** (`tryReverse`): Uses a top-down strategy. The
 * resolver first walks to the top of the parent chain, then refines on the
 * way back down. Each level tries its own anchors; the most specific (deepest)
 * match wins. This ensures that a child resolver's anchors take priority over
 * a parent's broader anchors when both match.
 *
 * @template ValidAnchors - Union of string literals for valid anchor names
 */
export abstract class BaseResolver<ValidAnchors extends string = string> implements IResolver<ValidAnchors> {
  constructor(
    public readonly name: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public readonly parent?: IResolver<any>,
    private readonly filesystem?: IFilesystem,
  ) {}

  // ========================================================================
  // Filesystem Access
  // ========================================================================

  /**
   * Get the filesystem for this resolver chain.
   * Returns this resolver's filesystem if set, otherwise delegates to parent.
   * Throws if no filesystem is found in the chain.
   */
  getFilesystem(): IFilesystem {
    if (this.filesystem) {
      return this.filesystem;
    }
    if (this.parent) {
      return this.parent.getFilesystem();
    }
    throw new Error(
      `Resolver "${this.name}" has no filesystem. ` +
      `Resolver chains must include an IFilesystem (either directly or via a parent resolver).`
    );
  }

  // ========================================================================
  // Resolution
  // ========================================================================

  /**
   * Resolve an anchor + relative path to an absolute OS path.
   *
   * Only resolves anchors this resolver understands. Unknown anchors throw
   * immediately — there is no parent delegation during forward resolution.
   */
  async resolve(anchor: Anchor, relative: RelativePath): Promise<ResolvedPath> {
    const anchorName = AnchorNS.name(anchor);
    if (!this.canResolve(anchor)) {
      throw new Error(
        `Resolver "${this.name}" cannot resolve anchor: ${anchorName}. ` +
        `Supported anchors: [${this.supportedAnchors().map(AnchorNS.name).join(', ')}]`
      );
    }

    const basePath = await this.resolveAnchor(anchor);
    const combined = this.joinPaths(basePath, relative);
    return this.toOSPath(combined);
  }

  // ========================================================================
  // OS Path Conversion
  // ========================================================================

  /**
   * Convert an intermediate resolved path to a final OS path.
   * Walks up the parent chain until a terminal resolver (Unix/Windows)
   * handles it. Non-terminal resolvers without a parent throw.
   */
  protected toOSPath(intermediatePath: ResolvedPath): ResolvedPath {
    if (this.parent instanceof BaseResolver) {
      return this.parent.toOSPath(intermediatePath);
    }
    throw new Error(
      `Resolver "${this.name}" cannot create OS paths. ` +
      `Resolver chains must terminate with a platform resolver (UnixResolver or WindowsResolver).`
    );
  }

  // ========================================================================
  // Abstract Methods (subclasses must implement)
  // ========================================================================

  /**
   * Resolve anchor to base path (async)
   * Subclasses implement this to provide anchor-specific resolution
   */
  protected abstract resolveAnchor(anchor: Anchor): Promise<ResolvedPath>;

  /**
   * Check if this resolver (not including parent) handles this anchor
   */
  abstract canResolve(anchor: Anchor): boolean;

  /**
   * List all anchors supported by this resolver (not including parent)
   */
  abstract supportedAnchors(): Anchor[];

  // ========================================================================
  // Path Joining
  // ========================================================================

  /**
   * Join base path with relative path (OS-specific)
   */
  protected joinPaths(base: ResolvedPath, relative: RelativePath): ResolvedPath {
    if (relative === RelativePathNS.EMPTY || relative === '') {
      return base;
    }
    const joined = path.join(base as string, relative as string);
    return ResolvedPathNS.make(joined);
  }

  // ========================================================================
  // Type-Safe PathFor Implementation
  // ========================================================================

  /**
   * Type-safe convenience method for creating FilePath objects
   *
   * @template A - Anchor name (constrained to ValidAnchors)
   * @param anchorName - The anchor name (type-checked at compile time)
   * @param relative - Optional relative path from anchor
   * @returns FilePath instance configured with this resolver
   *
   * @throws Error if this resolver cannot handle the anchor
   *
   * @example
   * ```typescript
   * class AppResolver extends BaseResolver<'userData' | 'temp'> {
   *   // PathFor is automatically type-safe
   * }
   *
   * const resolver = new AppResolver(new UnixResolver());
   * resolver.PathFor('userData');  // ✓ Valid
   * resolver.PathFor('temp');      // ✓ Valid
   * resolver.PathFor('drive_c');   // ✗ TypeScript error!
   * ```
   */
  PathFor<A extends ValidAnchors>(
    anchorName: A,
    relative: string = ''
  ): FilePath {
    const anchor = AnchorNS.make(anchorName);
    const relativePath = relative === '' ? RelativePathNS.EMPTY : RelativePathNS.make(relative);

    // FilePath constructor will validate that this resolver can handle the anchor
    return new FilePath(relativePath, anchor, this);
  }

  // ========================================================================
  // Reverse Resolution
  // ========================================================================

  /**
   * Cache of base paths (anchor → resolved path)
   * Populated on first reverse resolution to avoid repeated async calls
   */
  private basePathCache?: Promise<Map<Anchor, ResolvedPath>>;

  /**
   * Get all base paths for this resolver (with caching)
   */
  async getBasePaths(): Promise<Map<Anchor, ResolvedPath>> {
    if (this.basePathCache === undefined) {
      this.basePathCache = this.computeBasePaths();
    }
    return this.basePathCache;
  }

  /**
   * Compute base paths for all supported anchors
   * Override in subclass if you have a more efficient implementation
   */
  protected async computeBasePaths(): Promise<Map<Anchor, ResolvedPath>> {
    const basePaths = new Map<Anchor, ResolvedPath>();
    const anchors = this.supportedAnchors();

    // Resolve all anchors to get their base paths
    await Promise.all(
      anchors.map(async (anchor) => {
        try {
          const basePath = await this.resolveAnchor(anchor);
          const osPath = this.toOSPath(basePath);
          basePaths.set(anchor, osPath);
        } catch (_err) {
          // Anchor may not be resolvable — skip it silently
        }
      })
    );

    return basePaths;
  }

  /**
   * Try to reverse-resolve an OS path using top-down resolution.
   *
   * Walks to the top of the parent chain first, letting each level try
   * its anchors on the way back down. The most specific (deepest) match
   * wins, so child resolver anchors take priority over parent anchors.
   *
   * @returns FilePath instance using the appropriate resolver, or null if no resolver can handle it
   */
  async tryReverse(resolvedPath: ResolvedPath): Promise<FilePath | null> {
    // Walk to top parent first, then refine on way back down
    let result: FilePath | null = null;
    if (this.parent) {
      result = await this.parent.tryReverse(resolvedPath);
    }

    // Try self — if we match, our more-specific anchor wins
    const selfResult = await this.tryReverseSelf(resolvedPath);
    if (selfResult !== null) {
      return new FilePath(selfResult.relative, selfResult.anchor, this);
    }

    return result;
  }

  /**
   * Try to reverse-resolve an OS path using only this resolver (no parent delegation)
   *
   * Strategy:
   * 1. Get all base paths for this resolver
   * 2. Find the longest matching base path (most specific)
   * 3. Extract relative portion
   * 4. Return anchor + relative
   */
  protected async tryReverseSelf(resolvedPath: ResolvedPath): Promise<{
    anchor: Anchor;
    relative: RelativePath;
  } | null> {
    const basePaths = await this.getBasePaths();

    // Normalize path for comparison (handle case sensitivity, separators)
    const normalizedPath = this.normalizePath(resolvedPath);

    // Find longest matching base path (most specific wins)
    let bestMatch: { anchor: Anchor; basePath: ResolvedPath; relative: RelativePath } | null = null;

    for (const [anchor, basePath] of basePaths) {
      const normalizedBase = this.normalizePath(basePath);

      // Check if path starts with this base
      const isUnder = this.isUnder(normalizedPath, normalizedBase);

      if (isUnder) {
        const relative = this.extractRelative(normalizedPath, normalizedBase);

        // Keep the longest matching base (most specific)
        if (!bestMatch || normalizedBase.length > this.normalizePath(bestMatch.basePath).length) {
          bestMatch = { anchor, basePath, relative };
        }
      }
    }

    return bestMatch
      ? { anchor: bestMatch.anchor, relative: bestMatch.relative }
      : null;
  }

  /**
   * Clear cached base paths
   * Call this when resolver configuration changes (e.g., game paths updated)
   */
  clearBasePathCache(): void {
    this.basePathCache = undefined;
  }

  // ========================================================================
  // Private Helpers for Reverse Resolution
  // ========================================================================

  /**
   * Normalize path for comparison using the filesystem's normalization
   */
  private normalizePath(p: ResolvedPath): string {
    return this.getFilesystem().normalizePath(p as string);
  }

  /**
   * Check if path is under base path
   */
  private isUnder(childPath: string, basePath: string): boolean {
    const fs = this.getFilesystem();
    const normalizedChild = fs.normalizePath(childPath);
    const normalizedBase = fs.normalizePath(basePath);

    // Ensure base ends with separator for proper prefix matching
    const sep = path.sep;
    const baseWithSep = normalizedBase.endsWith(sep) ? normalizedBase : normalizedBase + sep;
    return normalizedChild.startsWith(baseWithSep) || normalizedChild === normalizedBase;
  }

  /**
   * Extract relative path from full path given base
   */
  private extractRelative(fullPath: string, basePath: string): RelativePath {
    // Use path.relative for cross-platform correctness
    const relative = path.relative(basePath, fullPath);

    // Convert to forward slashes (RelativePath convention)
    const normalized = relative.replace(/\\/g, '/');

    return normalized === '' ? RelativePathNS.EMPTY : RelativePathNS.make(normalized);
  }
}
