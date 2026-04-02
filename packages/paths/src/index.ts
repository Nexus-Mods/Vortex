// FilePath
export { FilePath } from "./FilePath";
// Filesystem interface
export { FileType, FileEntry } from "./IFilesystem";

export type { IFilesystem } from "./IFilesystem";
// Resolver interfaces
export type { IResolverBase, IResolver } from "./IResolver";

// Path utilities
export { posix, win32, detectPathModule, forPlatform } from "./pathUtils";

export type { PathModule } from "./pathUtils";
// Resolver implementations
export { BaseResolver } from "./resolvers/BaseResolver";

export {
  MappingResolver,
  fromRecord,
  fromMap,
  fromFunction,
} from "./resolvers/MappingResolver";

export type { MappingStrategy } from "./resolvers/MappingResolver";
export { UnixResolver } from "./resolvers/UnixResolver";
export type { UnixAnchor } from "./resolvers/UnixResolver";
export { WindowsResolver } from "./resolvers/WindowsResolver";
export type { WindowsDrive } from "./resolvers/WindowsResolver";
// Core types
export {
  RelativePath,
  RelativePathSchema,
  ResolvedPath,
  ResolvedPathSchema,
  Extension,
  ExtensionSchema,
  FileName,
  FileNameSchema,
  Anchor,
  fnv1a,
} from "./types";
export type { RelativePath as RelativePathType } from "./types";
