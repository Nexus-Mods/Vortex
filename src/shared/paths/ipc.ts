 /**
 * IPC Serialization for FilePath objects
 *
 * FilePath objects contain resolver references that can't be serialized across IPC boundaries.
 * This module provides serialization/deserialization helpers for sending FilePath objects
 * between processes (main ↔ renderer) or storing them in Redux.
 */

// eslint-disable-next-line vortex/no-module-imports
import { z } from 'zod';

import type { IResolverRegistry, SerializedFilePath } from './IResolver';

import { FilePath } from './FilePath';
import { RelativePath as RelativePathNS, Anchor as AnchorNS } from './types';
import { RelativePathSchema } from './types';

/**
 * Zod schema for validating serialized paths over IPC
 * Ensures data integrity when receiving FilePath objects from untrusted sources
 */
export const SerializedFilePathSchema = z.object({
  relative: RelativePathSchema,
  anchor: z.string().min(1),
  resolverName: z.string().min(1),
});

/**
 * IPC-safe FilePath serialization namespace
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace FilePathIPC {
  /**
   * Serialize FilePath for sending across IPC
   *
   * Converts FilePath to a JSON-safe object that can be sent via IPC
   * or stored in Redux state.
   *
   * @param filePath - FilePath to serialize
   * @returns Serializable object
   *
   * @example
   * ```typescript
   * // Main process
   * const filePath = vortexResolver.PathFor('userData', 'mods');
   * const serialized = FilePathIPC.serialize(filePath);
   *
   * // Send via IPC
   * mainWindow.webContents.send('path-data', serialized);
   * ```
   */
  export function serialize(filePath: FilePath): SerializedFilePath {
    return filePath.toJSON();
  }

  /**
   * Deserialize FilePath after receiving from IPC
   *
   * Requires access to resolver registry on the receiving side.
   * The resolver must be registered in the registry before deserialization.
   *
   * @param serialized - Serialized FilePath data
   * @param registry - Resolver registry to look up resolvers
   * @returns Reconstructed FilePath instance
   * @throws Error if resolver not found in registry
   * @throws Error if serialized data is invalid
   *
   * @example
   * ```typescript
   * // Renderer process
   * ipcRenderer.on('path-data', (event, serialized) => {
   *   // Validate with Zod
   *   const validated = SerializedFilePathSchema.parse(serialized);
   *
   *   // Recreate FilePath with explicit registry
   *   const filePath = FilePathIPC.deserialize(validated, myRegistry);
   *
   *   // Use it
   *   const resolved = await filePath.resolve();
   *   console.log(resolved); // C:\Users\...\mods
   * });
   * ```
   */
  export function deserialize(
    serialized: SerializedFilePath,
    registry: IResolverRegistry,
  ): FilePath {
    // Validate input
    const validated = SerializedFilePathSchema.parse(serialized);

    // Look up resolver
    const resolver = registry.getOrThrow(validated.resolverName);

    // Reconstruct FilePath
    return new FilePath(
      RelativePathNS.unsafe(validated.relative),
      AnchorNS.make(validated.anchor),
      resolver,
    );
  }

  /**
   * Alternative: Resolve to ResolvedPath before sending
   *
   * Use this when the receiving side doesn't need anchor context
   * and just needs the concrete OS path.
   *
   * @param filePath - FilePath to resolve and serialize
   * @returns Resolved absolute path as string
   *
   * @example
   * ```typescript
   * // Main process
   * const filePath = vortexResolver.PathFor('userData', 'mods');
   * const resolvedPath = await FilePathIPC.serializeResolved(filePath);
   *
   * // Send via IPC
   * mainWindow.webContents.send('resolved-path', resolvedPath);
   *
   * // Renderer process
   * ipcRenderer.on('resolved-path', (event, path: string) => {
   *   const resolved = ResolvedPath.make(path);
   *   fs.exists(resolved); // Use directly with filesystem
   * });
   * ```
   */
  export async function serializeResolved(filePath: FilePath): Promise<string> {
    const resolved = await filePath.resolve();
    return resolved as string;
  }

  /**
   * Serialize an array of FilePath objects
   *
   * @param filePaths - Array of FilePath objects
   * @returns Array of serialized FilePath objects
   *
   * @example
   * ```typescript
   * const paths = [
   *   resolver.PathFor('userData', 'mods'),
   *   resolver.PathFor('userData', 'downloads'),
   * ];
   * const serialized = FilePathIPC.serializeMany(paths);
   * mainWindow.webContents.send('paths', serialized);
   * ```
   */
  export function serializeMany(filePaths: FilePath[]): SerializedFilePath[] {
    return filePaths.map(serialize);
  }

  /**
   * Deserialize an array of FilePath objects
   *
   * @param serialized - Array of serialized FilePath objects
   * @param registry - Resolver registry to look up resolvers
   * @returns Array of reconstructed FilePath instances
   *
   * @example
   * ```typescript
   * ipcRenderer.on('paths', (event, serialized) => {
   *   const filePaths = FilePathIPC.deserializeMany(serialized, myRegistry);
   *   // Use the paths...
   * });
   * ```
   */
  export function deserializeMany(
    serialized: SerializedFilePath[],
    registry: IResolverRegistry,
  ): FilePath[] {
    return serialized.map(s => deserialize(s, registry));
  }

  /**
   * Resolve and serialize many FilePath objects
   *
   * @param filePaths - Array of FilePath objects
   * @returns Promise resolving to array of absolute paths
   *
   * @example
   * ```typescript
   * const paths = [
   *   resolver.PathFor('userData', 'mods'),
   *   resolver.PathFor('userData', 'downloads'),
   * ];
   * const resolved = await FilePathIPC.serializeManyResolved(paths);
   * mainWindow.webContents.send('resolved-paths', resolved);
   * ```
   */
  export async function serializeManyResolved(filePaths: FilePath[]): Promise<string[]> {
    return Promise.all(filePaths.map(serializeResolved));
  }

  /**
   * Check if an object looks like a serialized FilePath
   * Useful for type guards and validation
   *
   * @param obj - Object to check
   * @returns true if object matches SerializedFilePath shape
   */
  export function isSerializedFilePath(obj: unknown): obj is SerializedFilePath {
    const result = SerializedFilePathSchema.safeParse(obj);
    return result.success;
  }
}
