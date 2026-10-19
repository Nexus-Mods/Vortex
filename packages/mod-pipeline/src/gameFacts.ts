import type { Assert, MutuallyAssignable } from "./typeChecks";
import { z } from "./zodJitless";

/** A file in a mod's staging folder and where it deploys to. */
export interface StagedFile {
  /** absolute, "/" separated */
  destinationPath: string;
  fileHash: string;
}

/** What Vortex works out for a game outside its state. */
export interface GameFacts {
  /** Vortex's game id, keying the state */
  gameMode: string;
  /** Nexus numeric game id */
  gameId: string;
  gameVersion: string;
  storeId: string;
  /** mod ids in deployment order, as doSortMods returns them */
  sortedModIds: string[];
  /** keyed by mod id */
  stagedFiles: Record<string, StagedFile[]>;
}

const gameFactsSchema = z.object({
  gameMode: z.string(),
  gameId: z.string(),
  gameVersion: z.string(),
  storeId: z.string(),
  sortedModIds: z.array(z.string()),
  stagedFiles: z.record(
    z.string(),
    z.array(z.object({ destinationPath: z.string(), fileHash: z.string() })),
  ),
});

// typecheck fails when the schema and its type drift apart
type _GameFactsMatches = Assert<MutuallyAssignable<z.infer<typeof gameFactsSchema>, GameFacts>>;

export const GameFactsSchema: z.ZodType<GameFacts> = gameFactsSchema;
