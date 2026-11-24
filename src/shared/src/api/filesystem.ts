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

export type {
  Extension,
  Pattern,
  PathComponent,
  RelativePath,
  ResolvedPath,
} from "@nexusmods/paths";
export { matches, QualifiedPath, relativePath } from "@nexusmods/paths";

export type {
  IOSPathProvider,
  OSPathBase,
  PathProvider,
  PathResolver,
  PathResolverRegistry,
} from "../fs/paths";
export { OSPath, PathProviderError, PathResolverError, fromWire, toWire } from "../fs/paths";
export type { QualifiedPathWire } from "../fs/paths";

export { NativePathResolver } from "../fs/native-resolver";

export { XDG } from "../fs/paths.linux";
export type { LinuxPathBase, ILinuxPathProvider, XDGBase } from "../fs/paths.linux";

export { WindowsPath } from "../fs/paths.windows";
export type { WindowsPathBase, IWindowsPathProvider } from "../fs/paths.windows";

export type { VortexPathBase, IVortexPathProvider } from "../fs/paths.vortex";

export { InMemoryFS } from "../fs/in-memory";
export { InMemoryStore } from "../fs/in-memory-store";
export { Builder as InMemoryFSBuilder } from "../fs/in-memory-builder";
export { ChaosFS, type ChaosRule } from "../fs/chaos";
