export type {
  DirectoryStatus,
  FileStatus,
  FileSystemErrorCode,
  StatResult,
  Status,
  StatusTime,
  SymLinkData,
  SymLinkStatus,
  WebFileSystem as FileSystem,
  WebFileSystemBackend as FileSystemBackend,
  FileSystem as BaseFileSystem,
  FileSystemBackend as BaseFileSystemBackend,
} from "./filesystem";

export { FileSystemError } from "./filesystem";

export type { Pattern } from "./matcher";

export { matches } from "./matcher";

export type {
  ResolvedPath,
  Extension,
  PathComponent,
  PathProvider,
  PathResolver,
  OSPathProvider,
  OSPathBase,
} from "./paths";

export {
  QualifiedPath,
  OSPath,
  PathProviderError,
  PathResolverError,
} from "./paths";

export { XDG } from "./paths.linux";
export type { LinuxPathBase, LinuxPathProvider, XDGBase } from "./paths.linux";

export type { WindowsPathBase, WindowsPathProvider } from "./paths.windows";
