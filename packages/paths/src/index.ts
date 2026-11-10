export { PathError } from "./error";

export type { Pattern } from "./matcher";
export { matches } from "./matcher";

export type { Extension, PathComponent, RelativePath, ResolvedPath } from "./paths";

export { QualifiedPath, relativePath } from "./paths";

export { DIRECTORY_SEPARATOR, getPathRoot, isUnixRootType } from "./native";
