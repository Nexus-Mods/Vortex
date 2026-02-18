/**
 * Vortex Path System - Main Exports
 *
 * A deferred-resolution path library with type-safe resolvers and cross-platform support.
 *
 * @example
 * ```typescript
 * import {
 *   VortexResolver,
 *   FilePath,
 *   RelativePath,
 *   globalResolverRegistry,
 * } from './shared/paths';
 *
 * // Initialize resolver
 * const resolver = new VortexResolver();
 * globalResolverRegistry.setDefault(resolver);
 *
 * // Create paths
 * const modsPath = resolver.PathFor('userData', 'mods');
 * const resolved = await modsPath.resolve();
 * console.log(resolved); // C:\Users\...\mods
 * ```
 */

// ============================================================================
// Core Types
// ============================================================================

// Re-export IState and IDiscoveryResult for GameResolver users
export type { IState, IDiscoveryResult } from '../../renderer/types/IState';

export { FilePath } from './FilePath';

export { MockFilesystem } from './filesystem/MockFilesystem';

// ============================================================================
// FilePath Class
// ============================================================================

export { NodeFilesystem } from './filesystem/NodeFilesystem';

// ============================================================================
// Interfaces
// ============================================================================

export { UnixFilesystem } from './filesystem/UnixFilesystem';

export { WindowsFilesystem } from './filesystem/WindowsFilesystem';

// ============================================================================
// Filesystem Implementations
// ============================================================================

export type {
  IFilesystem,
  Stats,
  Dirent,
} from './IFilesystem';
export {
  FilePathIPC,
  SerializedFilePathSchema,
} from './ipc';
export type {
  IResolver,
  IResolverRegistry,
  SerializedFilePath,
} from './IResolver';
export {
  ResolverRegistry,
  globalResolverRegistry,
} from './ResolverRegistry';

// ============================================================================
// Resolver Base Classes
// ============================================================================

export { BaseResolver, CachingResolver } from './resolvers/BaseResolver';

export {
  MappingResolver,
  fromRecord,
  fromMap,
  fromFunction,
  type MappingStrategy,
} from './resolvers/MappingResolver';

// ============================================================================
// Resolver Implementations
// ============================================================================

export {
  GameResolver,
  type GameAnchor,
} from './resolvers/GameResolver';

export {
  ProtonResolver,
  type ProtonAnchor,
} from './resolvers/ProtonResolver';

export {
  UnixResolver,
  type UnixAnchor,
} from './resolvers/UnixResolver';

export {
  VortexResolver,
  type VortexAnchor,
} from './resolvers/VortexResolver';

export {
  WindowsResolver,
  type WindowsDrive,
} from './resolvers/WindowsResolver';

// ============================================================================
// Resolver Registry
// ============================================================================

export {
  // Branded types
  type RelativePath,
  type ResolvedPath,
  type Extension,
  type Anchor,
} from './types';

// ============================================================================
// IPC Serialization
// ============================================================================

// Export namespaces with constructors and utilities
export { RelativePath, ResolvedPath, Extension, Anchor } from './types';

// ============================================================================
// Re-export common dependencies (convenience)
// ============================================================================

// Export Zod schemas for validation
export {
  RelativePathSchema,
  ResolvedPathSchema,
  ExtensionSchema,
} from './types';
