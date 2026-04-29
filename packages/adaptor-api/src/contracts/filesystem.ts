import type { IFileSystem } from "@vortex/fs";

/**
 * Registers `vortex:host/filesystem` as the host filesystem service. The
 * contract is the `IFileSystem` interface from `@vortex/fs` itself — no
 * parallel `IFileSystemService` is needed.
 *
 * The wire-level protocol that carries this interface across the RPC
 * boundary (method names for flat calls, cursor methods for directory
 * enumeration, structured error envelope for `FileSystemError`) is a
 * transport implementation detail owned jointly by the adaptor-side
 * client polyfill in `@vortex/fs` (`createFileSystemClient`) and the
 * host-side handler in the main process. Adaptor authors see only the
 * plain `IFileSystem` surface.
 */
declare module "@nexusmods/adaptor-api" {
  interface ServiceRegistry {
    "vortex:host/filesystem": IFileSystem;
  }
}
