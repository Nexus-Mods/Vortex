export { provides, getProvidedUri } from "./builder";

export type {
  IMessage,
  IMessageHandler,
  IServiceProxy,
  IAdaptorRuntime,
  IServiceResolver,
  IHandlerRegistry,
  IAdaptorManifest,
  ServiceRegistry,
  ServiceAliases,
  ServiceFor,
  IMethodMessage,
} from "./interfaces";

export { getContainer } from "./runtime-container";

export type { URI, PID, MessageId, SemVer, AdaptorName } from "./types/branded";
export { uri, pid, messageId, semVer, adaptorName } from "./types/branded";

export type {
  EpicCatalogItemId,
  EpicCatalogNamespace,
  GOGGameId,
  NexusModsDomain,
  RegistryKey,
  SteamAppId,
  XboxPackageFamilyName,
} from "./types/store-ids";
export {
  epicCatalogItemId,
  epicCatalogNamespace,
  gogGameId,
  nexusModsDomain,
  registryKey,
  steamAppId,
  xboxPackageFamilyName,
} from "./types/store-ids";

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
} from "./fs/filesystem";
export { FileSystemError } from "./fs/filesystem";

export type { Pattern } from "./fs/matcher";
export { matches } from "./fs/matcher";

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
} from "./fs/paths";
export {
  QualifiedPath,
  qpath,
  OSPath,
  PathProviderError,
  PathResolverError,
  RelativePathError,
  relativePath,
} from "./fs/paths";

export { XDG } from "./fs/paths.linux";
export type { LinuxPathBase, LinuxPathProvider, XDGBase } from "./fs/paths.linux";

export { WindowsPath } from "./fs/paths.windows";
export type { WindowsPathBase, WindowsPathProvider } from "./fs/paths.windows";

export { Base, OS, Store } from "./stores/providers";
export type {
  CommonBase,
  LinuxBase,
  LinuxStorePathProvider,
  StorePathProvider,
  StorePathSnapshot,
  WindowsBase,
  WindowsStorePathProvider,
} from "./stores/providers";
export { createStorePathProvider } from "./stores/snapshot";
