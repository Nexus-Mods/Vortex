import { GameInstallSchema, type GameInstall } from "./gameInstall";
import { NexusFileUid, NexusGameId } from "./ids";
import type { Assert, MutuallyAssignable } from "./typeChecks";
import { z } from "./zodJitless";

/** The kinds of origin a deployed file has. */
export const FileSourceKind = {
  Nexus: "NEXUS",
  VortexGenerated: "VORTEX_GENERATED",
  UserGenerated: "USER_GENERATED",
} as const;
export type FileSourceKind = (typeof FileSourceKind)[keyof typeof FileSourceKind];

/** The algorithms a file hash is computed with. */
export const HashType = {
  Md5: "md5",
} as const;
export type HashType = (typeof HashType)[keyof typeof HashType];

/** Where a deployed file comes from. */
export type FileOrigin =
  | { source: typeof FileSourceKind.Nexus; fileUid: NexusFileUid }
  | { source: typeof FileSourceKind.VortexGenerated }
  | { source: typeof FileSourceKind.UserGenerated };

/** A file's absolute destination and its content's hash. */
export interface StagedFile {
  /** absolute, "/" separated */
  destinationPath: string;
  fileHash: string;
  hashType: HashType;
}

/** A deployed file: its origin, its content's hash and its absolute destination. */
export type FileSource = FileOrigin & StagedFile;

/** The resolved files of one game, the Plan step's input. */
export interface Lockfile {
  version: 1;
  gameId: NexusGameId;
  install: GameInstall;
  files: FileSource[];
}

const fileFields = {
  fileHash: z.string(),
  hashType: z.enum(HashType),
  destinationPath: z.string(),
};

export const StagedFileSchema: z.ZodType<StagedFile> = z.object(fileFields);

const fileSourceSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal(FileSourceKind.Nexus),
    fileUid: z.string().transform(NexusFileUid),
    ...fileFields,
  }),
  z.object({ source: z.literal(FileSourceKind.VortexGenerated), ...fileFields }),
  z.object({ source: z.literal(FileSourceKind.UserGenerated), ...fileFields }),
]);

const lockfileSchema = z.object({
  version: z.literal(1),
  gameId: z.number().int().transform(NexusGameId),
  install: GameInstallSchema,
  files: z.array(fileSourceSchema),
});

// typecheck fails when the schema and its type drift apart
type _LockfileMatches = Assert<MutuallyAssignable<z.infer<typeof lockfileSchema>, Lockfile>>;

export const LockfileSchema: z.ZodType<Lockfile> = lockfileSchema;
