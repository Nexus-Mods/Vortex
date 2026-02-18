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

import type { IResolver } from '../IResolver';
import type { Anchor, RelativePath, ResolvedPath } from '../types';

import { FilePath } from '../FilePath';
import { RelativePath as RelativePathNS, Anchor as AnchorNS, ResolvedPath as ResolvedPathNS } from '../types';

/**
 * Abstract base resolver with type-safe anchor support
 *
 * @template ValidAnchors - Union of string literals for valid anchor names
 */
export abstract class BaseResolver<ValidAnchors extends string = string> implements IResolver<ValidAnchors> {
  constructor(
    public readonly name: string,
  ) {}

  // ========================================================================
  // Resolution
  // ========================================================================

  /**
   * Async resolution - throws if anchor not supported
   */
  async resolve(anchor: Anchor, relative: RelativePath): Promise<ResolvedPath> {
    if (!this.canResolve(anchor)) {
      throw new Error(`Resolver "${this.name}" cannot handle anchor: ${AnchorNS.name(anchor)}`);
    }

    const basePath = await this.resolveAnchor(anchor);
    return this.joinPaths(basePath, relative);
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
   * class VortexResolver extends BaseResolver<'userData' | 'temp'> {
   *   // PathFor is automatically type-safe
   * }
   *
   * const resolver = new VortexResolver();
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
    if (!this.basePathCache) {
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
          basePaths.set(anchor, basePath);
        } catch (err) {
          // Anchor may not be resolvable (e.g., Proton on Windows)
          // Skip it silently
        }
      })
    );

    return basePaths;
  }

  /**
   * Try to reverse-resolve an OS path
   *
   * Strategy:
   * 1. Get all base paths for this resolver
   * 2. Find the longest matching base path (most specific)
   * 3. Extract relative portion
   * 4. Return anchor + relative
   */
  async tryReverse(resolvedPath: ResolvedPath): Promise<{
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
   * Normalize path for comparison
   * - Lowercase on case-insensitive platforms (Windows)
   * - Normalize separators
   */
  private normalizePath(p: ResolvedPath): string {
    let normalized = path.normalize(p as string);

    // Windows is case-insensitive
    if (process.platform === 'win32') {
      normalized = normalized.toLowerCase();
    }

    return normalized;
  }

  /**
   * Check if path is under base path
   */
  private isUnder(childPath: string, basePath: string): boolean {
    // Ensure base ends with separator for proper prefix matching
    const sep = path.sep;
    const baseWithSep = basePath.endsWith(sep) ? basePath : basePath + sep;
    return childPath.startsWith(baseWithSep) || childPath === basePath;
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

// ============================================================================
// CachingResolver - TTL-based caching wrapper
// ============================================================================

interface CacheEntry {
  value: Promise<ResolvedPath>;
  expiresAt: number;
}

/**
 * Caching wrapper for resolvers with TTL
 *
 * Caches resolution results for a configurable time period to reduce
 * repeated filesystem or IO operations.
 */
export class CachingResolver implements IResolver {
  private cache = new Map<string, CacheEntry>();

  constructor(
    private readonly inner: IResolver,
    private readonly ttlMs: number = 60000, // 1 minute default
  ) {}

  get name(): string {
    return `caching(${this.inner.name})`;
  }

  // ========================================================================
  // Resolution with Caching
  // ========================================================================

  async resolve(anchor: Anchor, relative: RelativePath): Promise<ResolvedPath> {
    const key = this.makeCacheKey(anchor, relative);
    const now = Date.now();

    // Check cache
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    // Resolve and cache
    const promise = this.inner.resolve(anchor, relative);
    this.cache.set(key, {
      value: promise,
      expiresAt: now + this.ttlMs,
    });

    // Clean up expired entries periodically
    this.cleanupExpired();

    return promise;
  }

  // ========================================================================
  // Delegation
  // ========================================================================

  canResolve(anchor: Anchor): boolean {
    return this.inner.canResolve(anchor);
  }

  supportedAnchors(): Anchor[] {
    return this.inner.supportedAnchors();
  }

  PathFor<A extends string>(anchorName: A, relative?: string): FilePath {
    // Delegate to inner resolver but use this caching resolver
    const anchor = AnchorNS.make(anchorName);
    if (!this.canResolve(anchor)) {
      throw new Error(`Resolver ${this.name} cannot resolve anchor: ${anchorName}`);
    }

    const relativePath = relative ? RelativePathNS.make(relative) : RelativePathNS.EMPTY;
    return new FilePath(relativePath, anchor, this);
  }

  // ========================================================================
  // Reverse Resolution (Delegated)
  // ========================================================================

  async tryReverse(resolvedPath: ResolvedPath): Promise<{
    anchor: Anchor;
    relative: RelativePath;
  } | null> {
    return this.inner.tryReverse(resolvedPath);
  }

  async getBasePaths(): Promise<Map<Anchor, ResolvedPath>> {
    return this.inner.getBasePaths();
  }

  // ========================================================================
  // Cache Management
  // ========================================================================

  /**
   * Clear all cached entries
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear entries for a specific anchor
   */
  clearAnchor(anchor: Anchor): void {
    const anchorName = AnchorNS.name(anchor);
    const prefix = `${anchorName}:`;

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number } {
    return {
      size: this.cache.size,
    };
  }

  // ========================================================================
  // Private Helpers
  // ========================================================================

  private makeCacheKey(anchor: Anchor, relative: RelativePath): string {
    const anchorName = AnchorNS.name(anchor);
    return `${anchorName}:${relative}`;
  }

  private cleanupExpired(): void {
    const now = Date.now();

    // Cleanup cache
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }
}
