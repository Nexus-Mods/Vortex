export type {
  DirectoryStatus,
  FileStatus,
  FileSystemErrorCode,
  StatResult,
  Status,
  StatusTime,
  SymLinkData,
  SymLinkStatus,
  WebFileSystem,
  WebFileSystemBackend,
  FileSystem as BaseFileSystem,
  FileSystemBackend as BaseFileSystemBackend,
} from "../browser/filesystem";

export { FileSystemError } from "../browser/filesystem";

export type { Pattern } from "../browser/matcher";

export { matches } from "../browser/matcher";

export type {
  ResolvedPath,
  Extension,
  PathComponent,
  PathProvider,
  PathResolver,
  OSPathProvider,
  OSPathBase,
} from "../browser/paths";

export {
  QualifiedPath,
  qpath,
  OSPath,
  PathProviderError,
  PathResolverError,
} from "../browser/paths";

export { XDG } from "../browser/paths.linux";
export type {
  LinuxPathBase,
  LinuxPathProvider,
  XDGBase,
} from "../browser/paths.linux";

export { WindowsPath } from "../browser/paths.windows";
export type {
  WindowsPathBase,
  WindowsPathProvider,
} from "../browser/paths.windows";

export type {
  NodeFileSystem as FileSystem,
  NodeFileSystemBackend as FileSystemBackend,
} from "./filesystem";
