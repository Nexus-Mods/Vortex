import type { FolderCheckBucket, FolderCheckFile, FolderCheckResult } from "@vortex/shared/ipc";

export interface IFolderSummary {
  counts: Record<FolderCheckBucket, { files: number; bytes: number }>;
  modified: number;
  missing: number;
  changedSinceDeployed: { files: number; bytes: number };
  /** Sorted by file count, descending */
  unknownGroups: { folder: string; files: FolderCheckFile[]; bytes: number }[];
}

/** Totals for the page, with unknown files grouped by the first `groupDepth` folders of their path. */
export function summarise(result: FolderCheckResult, groupDepth = 3): IFolderSummary {
  const summary: IFolderSummary = {
    counts: {
      game: { files: 0, bytes: 0 },
      vortex: { files: 0, bytes: 0 },
      unknown: { files: 0, bytes: 0 },
    },
    modified: 0,
    missing: result.missing.length,
    changedSinceDeployed: { files: 0, bytes: 0 },
    unknownGroups: [],
  };
  const groups = new Map<string, IFolderSummary["unknownGroups"][number]>();

  for (const file of result.files) {
    summary.counts[file.bucket].files++;
    summary.counts[file.bucket].bytes += file.size;
    if (file.modified) summary.modified++;
    if (file.changedSinceDeployed) {
      summary.changedSinceDeployed.files++;
      summary.changedSinceDeployed.bytes += file.size;
    }
    if (file.bucket === "unknown") {
      const segments = file.relPath.split(/[\\/]/);
      const folders = segments.slice(0, -1);
      const key = folders.length > 0 ? folders.slice(0, groupDepth).join("\\") : file.relPath;
      const group = groups.get(key) ?? { folder: key, files: [], bytes: 0 };
      group.files.push(file);
      group.bytes += file.size;
      groups.set(key, group);
    }
  }

  summary.unknownGroups = [...groups.values()].toSorted((a, b) => b.files.length - a.files.length);
  return summary;
}
