import { HashType, type FileEntry } from "./lockfile";
import type { Assert, MutuallyAssignable } from "./typeChecks";
import { z } from "./zodJitless";

/** The kinds of entry a disk scan lists; folders are not listed. */
export const DiskEntryKind = {
  File: "file",
  Link: "link",
} as const;
export type DiskEntryKind = (typeof DiskEntryKind)[keyof typeof DiskEntryKind];

/**
 * A file or link under a scanned folder. The fields mean what they mean on the FS abstraction's
 * FileStatus: for a link, size, times and ids are its target's.
 */
export interface DiskEntry {
  /** absolute, "/" separated */
  path: string;
  kind: DiskEntryKind;
  size: number;
  modifiedTime: Temporal.Instant;
  /** with deviceId, identifies the file, so a hardlink and a symlink share their target's */
  id?: bigint;
  deviceId?: bigint;
  /** above 1 when the file is hardlinked elsewhere */
  hardlinkCount?: number;
  /**
   * the content, a link's being its target's, hashed with the lockfile's hash type; an entry
   * without one counts as the file the previous lockfile deployed there
   */
  contentHash?: Pick<FileEntry, "fileHash" | "hashType">;
}

/** The files under the deployment targets, taken before planning. */
export interface DiskScan {
  /** provenance only */
  takenAt: Temporal.Instant;
  /** absolute folders scanned; every destination sits under one */
  roots: string[];
  /** sorted by path */
  entries: DiskEntry[];
}

// JSON has no Temporal or bigint, so fixtures write an ISO instant and a decimal string
const instantSchema = z.codec(
  z.iso.datetime({ offset: true }),
  z.custom<Temporal.Instant>((value) => value instanceof Temporal.Instant),
  { decode: (text) => Temporal.Instant.from(text), encode: (instant) => instant.toString() },
);
const bigintSchema = z.codec(z.string().regex(/^\d+$/), z.bigint(), {
  decode: (text) => BigInt(text),
  encode: (value) => value.toString(),
});

const diskScanSchema = z.object({
  takenAt: instantSchema,
  roots: z.array(z.string()),
  entries: z.array(
    z.object({
      path: z.string(),
      kind: z.enum(DiskEntryKind),
      size: z.number(),
      modifiedTime: instantSchema,
      id: bigintSchema.optional(),
      deviceId: bigintSchema.optional(),
      hardlinkCount: z.number().int().optional(),
      contentHash: z.object({ fileHash: z.string(), hashType: z.enum(HashType) }).optional(),
    }),
  ),
});

// typecheck fails when the schema and its type drift apart
type _DiskScanMatches = Assert<MutuallyAssignable<z.infer<typeof diskScanSchema>, DiskScan>>;

export const DiskScanSchema: z.ZodType<DiskScan> = diskScanSchema;
