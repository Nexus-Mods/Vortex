/**
 * Semantic filesystem error code.
 *
 * Single source of truth shared by the filesystem contract in
 * `@nexusmods/adaptor-api/fs` (which normalizes raw Node errors into these
 * codes).
 *
 * @public
 */
export type FileSystemErrorCode =
  | "already exists"
  | "directory not empty"
  | "no permissions"
  | "no space"
  | "not a directory"
  | "not a file"
  | "not found"
  | "generic";
