import type { FileSystem } from "@nexusmods/adaptor-api";

/**
 * Registers `vortex:host/filesystem` as the host filesystem service. The
 * contract is the `FileSystem` interface from `@nexusmods/adaptor-api/fs` itself — no
 * parallel `FileSystemService` is needed.
 *
 * The wire-level protocol that carries this interface across the RPC
 * boundary (method names for flat calls, cursor methods for directory
 * enumeration, structured error envelope for `FileSystemError`) is a
 * transport implementation detail owned jointly by the adaptor-side
 * client polyfill in `@nexusmods/adaptor-api/fs` (`createFileSystemClient`) and the
 * host-side handler in the main process. Adaptor authors see only the
 * plain `FileSystem` surface.
 */
declare module "@nexusmods/adaptor-api" {
  interface ServiceRegistry {
    "vortex:host/filesystem": FileSystem;
  }
}
