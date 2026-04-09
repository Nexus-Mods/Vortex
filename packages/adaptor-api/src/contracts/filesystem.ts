import type { BaseFileSystem } from "@vortex/fs";

/**
 * Host-provided filesystem service proxied over RPC.
 */
//eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IFileSystemService extends Omit<
  BaseFileSystem,
  "enumerateDirectory"
> {}

declare module "@vortex/adaptor-api" {
  interface ServiceRegistry {
    "vortex:host/filesystem": IFileSystemService;
  }
}
