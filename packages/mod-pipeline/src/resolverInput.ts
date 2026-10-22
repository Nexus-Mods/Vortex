import { GameInstallSchema, type GameInstall } from "./gameInstall";
import { NexusFileUid, NexusGameId } from "./ids";
import { FileSourceKind, StagedFileSchema, type FileOrigin, type StagedFile } from "./lockfile";
import type { Assert, MutuallyAssignable } from "./typeChecks";
import { z } from "./zodJitless";

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
  gameId: NexusGameId;
  install: GameInstall;
  /** in deployment order */
  mods: ResolverMod[];
}

const resolverInputSchema = z.object({
  gameId: z.number().int().transform(NexusGameId),
  install: GameInstallSchema,
  mods: z.array(
    z.object({
      origin: z.discriminatedUnion("source", [
        z.object({
          source: z.literal(FileSourceKind.Nexus),
          fileUid: z.string().transform(NexusFileUid),
        }),
        z.object({ source: z.literal(FileSourceKind.UserGenerated) }),
      ]),
      stagedFiles: z.array(StagedFileSchema),
      overriddenPaths: z.array(z.string()),
    }),
  ),
});

// typecheck fails when the schema and its type drift apart
type _ResolverInputMatches = Assert<
  MutuallyAssignable<z.infer<typeof resolverInputSchema>, ResolverInput>
>;

export const ResolverInputSchema: z.ZodType<ResolverInput> = resolverInputSchema;
