import type { Assert, MutuallyAssignable } from "./typeChecks";
import { z } from "./zodJitless";

/** The kinds of origin a deployed file has. */
export const FileSourceKind = {
  Nexus: "NEXUS",
  VortexGenerated: "VORTEX_GENERATED",
  UserGenerated: "USER_GENERATED",
} as const;
export type FileSourceKind = (typeof FileSourceKind)[keyof typeof FileSourceKind];

/** Where a deployed file comes from. */
export type FileOrigin =
  | { source: typeof FileSourceKind.Nexus; fileId: string }
  | { source: typeof FileSourceKind.VortexGenerated }
  | { source: typeof FileSourceKind.UserGenerated };

/** A deployed file: its origin and absolute destination. */
export type FileSource = FileOrigin & { fileHash: string; destinationPath: string };

/** The resolved files of one game, the Plan step's input. */
export interface Lockfile {
  version: number;
  /** Nexus Mods numeric game id */
  gameId: number;
  gameVersion: string;
  storeId: string;
  files: FileSource[];
}

const fileSourceSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal(FileSourceKind.Nexus),
    fileId: z.string(),
    fileHash: z.string(),
    destinationPath: z.string(),
  }),
  z.object({
    source: z.literal(FileSourceKind.VortexGenerated),
    fileHash: z.string(),
    destinationPath: z.string(),
  }),
  z.object({
    source: z.literal(FileSourceKind.UserGenerated),
    fileHash: z.string(),
    destinationPath: z.string(),
  }),
]);

const lockfileSchema = z.object({
  version: z.number().int(),
  gameId: z.number().int(),
  gameVersion: z.string(),
  storeId: z.string(),
  files: z.array(fileSourceSchema),
});

// typecheck fails when the schema and its type drift apart
type _LockfileMatches = Assert<MutuallyAssignable<z.infer<typeof lockfileSchema>, Lockfile>>;

export const LockfileSchema: z.ZodType<Lockfile> = lockfileSchema;
