/**
 * ResolverRegistry - Centralized registry for resolver instances
 *
 * Manages resolver instances and provides lookup by name.
 * Used for deserialization of FilePath objects from IPC/Redux.
 */

import type { IResolver, IResolverRegistry } from './IResolver';

/**
 * Registry for managing resolver instances
 *
 * @example
 * ```typescript
 * const registry = new ResolverRegistry();
 *
 * // Register resolvers
 * const vortexResolver = new VortexResolver();
 * registry.register(vortexResolver);
 * registry.setDefault(vortexResolver);
 *
 * const gameResolver = new GameResolver(getState, vortexResolver);
 * registry.register(gameResolver);
 *
 * // Look up resolvers
 * const resolver = registry.get('vortex');
 * const defaultResolver = registry.getDefault();
 * ```
 */
export class ResolverRegistry implements IResolverRegistry {
  private resolvers = new Map<string, IResolver>();
  private defaultResolver?: IResolver;

  /**
   * Register a resolver instance
   *
   * @param resolver - Resolver to register
   * @throws Error if a resolver with the same name is already registered
   */
  register(resolver: IResolver): void {
    if (this.resolvers.has(resolver.name)) {
      throw new Error(`Resolver already registered: ${resolver.name}`);
    }
    this.resolvers.set(resolver.name, resolver);
  }

  /**
   * Register or update a resolver (replaces existing)
   *
   * @param resolver - Resolver to register or update
   */
  registerOrUpdate(resolver: IResolver): void {
    this.resolvers.set(resolver.name, resolver);
  }

  /**
   * Unregister a resolver
   *
   * @param name - Name of resolver to unregister
   * @returns true if resolver was found and removed
   */
  unregister(name: string): boolean {
    return this.resolvers.delete(name);
  }

  /**
   * Get resolver by name (returns undefined if not found)
   *
   * @param name - Resolver name
   * @returns Resolver instance or undefined
   */
  get(name: string): IResolver | undefined {
    return this.resolvers.get(name);
  }

  /**
   * Get resolver by name (throws if not found)
   *
   * @param name - Resolver name
   * @returns Resolver instance
   * @throws Error if resolver not found
   */
  getOrThrow(name: string): IResolver {
    const resolver = this.get(name);
    if (!resolver) {
      throw new Error(`Resolver not found: ${name}`);
    }
    return resolver;
  }

  /**
   * Check if a resolver is registered
   *
   * @param name - Resolver name
   * @returns true if registered
   */
  has(name: string): boolean {
    return this.resolvers.has(name);
  }

  /**
   * Set the default resolver for the registry
   * Also registers the resolver if not already registered
   *
   * @param resolver - Resolver to set as default
   */
  setDefault(resolver: IResolver): void {
    this.defaultResolver = resolver;
    if (!this.has(resolver.name)) {
      this.register(resolver);
    }
  }

  /**
   * Get the default resolver (throws if not set)
   *
   * @returns Default resolver
   * @throws Error if no default resolver set
   */
  getDefault(): IResolver {
    if (!this.defaultResolver) {
      throw new Error('No default resolver set');
    }
    return this.defaultResolver;
  }

  /**
   * Check if a default resolver is set
   *
   * @returns true if default resolver is set
   */
  hasDefault(): boolean {
    return this.defaultResolver !== undefined;
  }

  /**
   * Get all registered resolver names
   *
   * @returns Array of resolver names
   */
  getResolverNames(): string[] {
    return Array.from(this.resolvers.keys());
  }

  /**
   * Get all registered resolvers
   *
   * @returns Array of resolver instances
   */
  getAllResolvers(): IResolver[] {
    return Array.from(this.resolvers.values());
  }

  /**
   * Clear all registered resolvers (including default)
   */
  clear(): void {
    this.resolvers.clear();
    this.defaultResolver = undefined;
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalResolvers: number;
    resolverNames: string[];
    hasDefault: boolean;
    defaultName?: string;
  } {
    return {
      totalResolvers: this.resolvers.size,
      resolverNames: this.getResolverNames(),
      hasDefault: this.hasDefault(),
      defaultName: this.defaultResolver?.name,
    };
  }
}

/**
 * Global singleton registry instance
 * Use this for application-wide resolver management
 */
export const globalResolverRegistry = new ResolverRegistry();
