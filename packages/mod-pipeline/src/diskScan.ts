import { HashType, type FileEntry } from "./lockfile";
import type { Assert, MutuallyAssignable } from "./typeChecks";
import { z } from "./zodJitless";

/** The kinds of entry a disk scan lists; folders are not listed. */
export const DiskEntryKind = {
  File: "file",
  Link: "link",
} as const;
export type DiskEntryKind = (typeof DiskEntryKind)[keyof typeof DiskEntryKind];

/** A file or link under a scanned folder, read without following links. */
export interface DiskEntry {
  /** absolute, "/" separated */
  path: string;
  kind: DiskEntryKind;
  size: number;
  mtimeMs: number;
  /** identifies hardlinks to the same file */
  inode?: string;
  /** above 1 when the file is hardlinked elsewhere */
  nlink?: number;
  /** where a link points, even when that is gone */
  linkTarget?: string;
  /**
   * the content, a link's being its target's, hashed with the lockfile's hash type; an entry
   * without one counts as the file the previous lockfile deployed there
   */
  contentHash?: Pick<FileEntry, "fileHash" | "hashType">;
}

/** The files under the deployment targets, taken before planning. */
export interface DiskScan {
  /** provenance only */
  takenAt: string;
  /** absolute folders scanned; every destination sits under one */
  roots: string[];
  /** sorted by path */
  entries: DiskEntry[];
}

const diskScanSchema = z.object({
  takenAt: z.string(),
  roots: z.array(z.string()),
  entries: z.array(
    z.object({
      path: z.string(),
      kind: z.enum(DiskEntryKind),
      size: z.number(),
      mtimeMs: z.number(),
      inode: z.string().optional(),
      nlink: z.number().int().optional(),
      linkTarget: z.string().optional(),
      contentHash: z.object({ fileHash: z.string(), hashType: z.enum(HashType) }).optional(),
    }),
  ),
});

// typecheck fails when the schema and its type drift apart
type _DiskScanMatches = Assert<MutuallyAssignable<z.infer<typeof diskScanSchema>, DiskScan>>;

export const DiskScanSchema: z.ZodType<DiskScan> = diskScanSchema;
