import type { QualifiedPath, StatResult } from "@vortex/fs";

/**
 * Host-provided filesystem service proxied over RPC.
 * Accepts QualifiedPath URIs — the host resolves and executes operations.
 *
 * Note: enumerateDirectory and streaming are deferred (iterators/streams
 * don't serialize over RPC trivially).
 */
export interface IFileSystemService {
  copy(
    source: QualifiedPath,
    target: QualifiedPath,
    options?: { overwrite: boolean },
  ): Promise<void>;

  move(
    source: QualifiedPath,
    target: QualifiedPath,
    options?: { overwrite: boolean },
  ): Promise<void>;

  readFile(path: QualifiedPath): Promise<Uint8Array>;

  writeFile(path: QualifiedPath, contents: Uint8Array): Promise<void>;

  createDirectory(path: QualifiedPath): Promise<void>;

  delete(path: QualifiedPath): Promise<void>;

  deleteRecursive(path: QualifiedPath): Promise<void>;

  stat(
    path: QualifiedPath,
    options?: { parseSymLink: boolean },
  ): Promise<StatResult>;
}

declare module "@vortex/adaptor-api" {
  interface ServiceRegistry {
    "vortex:host/filesystem": IFileSystemService;
  }
}
