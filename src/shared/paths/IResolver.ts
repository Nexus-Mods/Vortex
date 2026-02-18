/**
 * IResolver interface with type-safe anchor support
 *
 * Resolvers map anchors to concrete OS paths. They support:
 * - Chainable parent delegation
 * - Type-safe anchor names via generic parameter
 * - Both async and optional sync resolution
 * - Introspection (canResolve, supportedAnchors)
 */

import type { Anchor, RelativePath, ResolvedPath } from './types';

/**
 * Generic resolver interface with type-safe anchor names
 *
 * @template ValidAnchors - Union of string literals representing valid anchor names
 *
 * @example
 * ```typescript
 * type VortexAnchors = 'userData' | 'temp' | 'documents';
 * class VortexResolver implements IResolver<VortexAnchors> {
 *   PathFor<A extends VortexAnchors>(anchorName: A): FilePath {
 *     // TypeScript enforces anchorName is one of: 'userData' | 'temp' | 'documents'
 *   }
 * }
 * ```
 */
export interface IResolver<ValidAnchors extends string = string> {
  /**
   * Unique name for serialization and debugging
   * Used to look up resolvers in the registry
   */
  readonly name: string;

  /**
   * Optional parent resolver for delegation
   * If this resolver can't handle an anchor, it delegates to the parent
   */
  readonly parent?: IResolver;

  /**
   * Primary resolution method (async - may require IO)
   *
   * @param anchor - The anchor to resolve
   * @param relative - The relative path from the anchor
   * @returns Promise resolving to the absolute OS path
   * @throws Error if no resolver in the chain can handle this anchor
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
   * const resolver = new VortexResolver();
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
}

/**
 * Interface for resolver registry
 * Manages resolver instances and provides lookup by name
 */
export interface IResolverRegistry {
  /**
   * Register a resolver instance
   */
  register(resolver: IResolver): void;

  /**
   * Get resolver by name (returns undefined if not found)
   */
  get(name: string): IResolver | undefined;

  /**
   * Get resolver by name (throws if not found)
   */
  getOrThrow(name: string): IResolver;

  /**
   * Set the default resolver for the registry
   */
  setDefault(resolver: IResolver): void;

  /**
   * Get the default resolver (throws if not set)
   */
  getDefault(): IResolver;
}

/**
 * Forward declaration of FilePath class
 * Actual implementation is in FilePath.ts to avoid circular dependency
 */
export interface FilePath {
  readonly relative: RelativePath;
  readonly anchor: Anchor;
  readonly resolver: IResolver;

  resolve(): Promise<ResolvedPath>;
  join(...segments: string[]): FilePath;
  withResolver(newResolver: IResolver): FilePath;
  withAnchor(newAnchor: Anchor): FilePath;
  toJSON(): SerializedFilePath;
  toString(): string;
}

/**
 * Serializable representation of FilePath for IPC
 */
export interface SerializedFilePath {
  relative: string;
  anchor: string;
  resolverName: string;
}
