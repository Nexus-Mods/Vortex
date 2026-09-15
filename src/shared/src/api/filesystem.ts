export type {
  DirectoryStatus,
  FileStatus,
  FileSystem,
  FileSystemBackend,
  StatResult,
  Status,
  StatusTime,
  SymLinkData,
  SymLinkStatus,
} from "../fs/filesystem";

export type { Pattern } from "../fs/matcher";
export { matches } from "../fs/matcher";

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
} from "../fs/paths";
export {
  QualifiedPath,
  OSPath,
  PathProviderError,
  PathResolverError,
  relativePath,
} from "../fs/paths";
export type { QualifiedPathWire } from "../fs/paths";

export { XDG } from "../fs/paths.linux";
export type { LinuxPathBase, LinuxPathProvider, XDGBase } from "../fs/paths.linux";

export { WindowsPath } from "../fs/paths.windows";
export type { WindowsPathBase, WindowsPathProvider } from "../fs/paths.windows";
