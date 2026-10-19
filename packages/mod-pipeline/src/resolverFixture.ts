import { GameFactsSchema, type GameFacts } from "./gameFacts";
import { LockfileSchema, type Lockfile } from "./lockfile";
import { StateSchema, type IState } from "./state";
import type { Assert, MutuallyAssignable } from "./typeChecks";
import { z } from "./zodJitless";

/** Vortex state and game facts, and the lockfile they must resolve to. */
export interface ResolverFixture {
  /** the behaviour it proves; the test name */
  name: string;
  state: IState;
  gameFacts: GameFacts;
  expected: Lockfile;
}

const resolverFixtureSchema = z.object({
  name: z.string(),
  state: StateSchema,
  gameFacts: GameFactsSchema,
  expected: LockfileSchema,
});

// typecheck fails when the schema and its type drift apart
type _ResolverFixtureMatches = Assert<
  MutuallyAssignable<z.infer<typeof resolverFixtureSchema>, ResolverFixture>
>;

export const ResolverFixtureSchema: z.ZodType<ResolverFixture> = resolverFixtureSchema;
