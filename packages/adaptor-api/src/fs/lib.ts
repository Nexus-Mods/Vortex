export type {
  DirectoryStatus,
  FileStatus,
  FileSystem,
  FileSystemBackend,
  FileSystemErrorCode,
  StatResult,
  Status,
  StatusTime,
  SymLinkData,
  SymLinkStatus,
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
  PathResolverRegistry,
  OSPathProvider,
  OSPathBase,
  RelativePath,
} from "./paths";
export {
  QualifiedPath,
  qpath,
  OSPath,
  PathProviderError,
  PathResolverError,
  RelativePathError,
  relativePath,
} from "./paths";

export { XDG } from "./paths.linux";
export type { LinuxPathBase, LinuxPathProvider, XDGBase } from "./paths.linux";

export { WindowsPath } from "./paths.windows";
export type { WindowsPathBase, WindowsPathProvider } from "./paths.windows";
