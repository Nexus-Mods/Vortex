/**
 * Shared helpers for logical archive-entry paths.
 */
import { RelativePath } from "@vortex/paths";

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
  const baseName = RelativePath.basename(relative);
  const dotIndex = baseName.lastIndexOf(".");
  return dotIndex <= 0 ? "" : baseName.slice(dotIndex);
}

export function toLowerCaseSegments(filePath: RelativePath): string[] {
  if (filePath === RelativePath.EMPTY) {
    return [];
  }

  return RelativePath.toString(filePath).toLowerCase().split("/");
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
