import { LockfileSchema, type Lockfile } from "./lockfile";
import { ResolverInputSchema, type ResolverInput } from "./resolverInput";
import type { Assert, MutuallyAssignable } from "./typeChecks";
import { z } from "./zodJitless";

/** A resolver input and the lockfile it must resolve to. */
export interface ResolverFixture {
  /** the behaviour it proves; the test name */
  name: string;
  input: ResolverInput;
  expected: Lockfile;
}

const resolverFixtureSchema = z.object({
  name: z.string(),
  input: ResolverInputSchema,
  expected: LockfileSchema,
});

// typecheck fails when the schema and its type drift apart
type _ResolverFixtureMatches = Assert<
  MutuallyAssignable<z.infer<typeof resolverFixtureSchema>, ResolverFixture>
>;

export const ResolverFixtureSchema: z.ZodType<ResolverFixture> = resolverFixtureSchema;
