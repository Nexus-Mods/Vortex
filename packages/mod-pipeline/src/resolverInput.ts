import { FileSourceKind, type FileOrigin } from "./lockfile";
import type { Assert, MutuallyAssignable } from "./typeChecks";
import { z } from "./zodJitless";

/** A file a mod deploys and its hash. */
export interface StagedFile {
  /** absolute, "/" separated */
  destinationPath: string;
  fileHash: string;
}

/** A mod that deploys, as the resolver reads it. */
export interface ResolverMod {
  /** never Vortex generated */
  origin: Exclude<FileOrigin, { source: typeof FileSourceKind.VortexGenerated }>;
  stagedFiles: StagedFile[];
  /** destinations this mod leaves to earlier mods; absolute, "/" separated */
  overriddenPaths: string[];
}

/** A game's deploying mods and its lockfile details. */
export interface ResolverInput {
  /** Nexus Mods numeric game id */
  gameId: number;
  gameVersion: string;
  storeId: string;
  /** in deployment order */
  mods: ResolverMod[];
}

const resolverInputSchema = z.object({
  gameId: z.number().int(),
  gameVersion: z.string(),
  storeId: z.string(),
  mods: z.array(
    z.object({
      origin: z.discriminatedUnion("source", [
        z.object({ source: z.literal(FileSourceKind.Nexus), fileId: z.string() }),
        z.object({ source: z.literal(FileSourceKind.UserGenerated) }),
      ]),
      stagedFiles: z.array(z.object({ destinationPath: z.string(), fileHash: z.string() })),
      overriddenPaths: z.array(z.string()),
    }),
  ),
});

// typecheck fails when the schema and its type drift apart
type _ResolverInputMatches = Assert<
  MutuallyAssignable<z.infer<typeof resolverInputSchema>, ResolverInput>
>;

export const ResolverInputSchema: z.ZodType<ResolverInput> = resolverInputSchema;
