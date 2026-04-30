import type { QualifiedPath } from "@vortex/fs";

/**
 * Declarative version detection strategies. The adaptor declares which
 * strategy to use; the host resolves the QualifiedPath to a native
 * filesystem path and executes the detection.
 *
 * @public
 */
export type VersionSource =
  | PEHeaderVersionSource
  | TextFileVersionSource;

/** Reads the version resource embedded in a Windows PE executable. */
export interface PEHeaderVersionSource {
  readonly type: "pe-header";
  readonly path: QualifiedPath;
}

/**
 * Reads a version string from a text file. When `regex` is provided,
 * the first capture group of the match is used as the version.
 * Otherwise the entire file content (trimmed) is used.
 */
export interface TextFileVersionSource {
  readonly type: "text-file";
  readonly path: QualifiedPath;
  readonly regex?: string;
}

/** Shorthand: detect version from a PE executable's version resource. */
export function peHeader(path: QualifiedPath): PEHeaderVersionSource {
  return { type: "pe-header", path };
}

/** Shorthand: detect version from a text file, optionally with a regex. */
export function textFile(
  path: QualifiedPath,
  regex?: string,
): TextFileVersionSource {
  return { type: "text-file", path, regex };
}
