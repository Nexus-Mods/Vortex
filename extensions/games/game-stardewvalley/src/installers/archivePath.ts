/**
 * Shared helpers for logical archive-entry paths.
 */
import { RelativePath, posix } from "@vortex/paths";

export interface IArchiveEntryPath {
  original: string;
  relative: RelativePath;
}

export function toArchiveEntries(files: string[]): IArchiveEntryPath[] {
  return files
    .map(toArchiveEntryPath)
    .filter((entry): entry is IArchiveEntryPath => entry !== undefined);
}

export function isArchiveDirectoryEntry(filePath: string): boolean {
  return /[\\/]$/.test(filePath);
}

export function getArchiveExtension(relative: RelativePath): string {
  return posix.extname(RelativePath.basename(relative));
}

function toArchiveEntryPath(filePath: string): IArchiveEntryPath | undefined {
  try {
    return {
      original: filePath,
      relative: RelativePath.make(filePath),
    };
  } catch {
    return undefined;
  }
}
