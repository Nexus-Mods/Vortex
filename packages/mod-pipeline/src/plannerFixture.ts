import { DiskScanSchema, type DiskScan } from "./diskScan";
import { LockfileSchema, type Lockfile } from "./lockfile";
import { OperationSchema, type Operation } from "./plan";
import type { Assert, MutuallyAssignable } from "./typeChecks";
import { z } from "./zodJitless";

/** A planner input and the operations it must plan, in order. */
export interface PlannerFixture {
  /** the behaviour it proves; the test name */
  name: string;
  current: Lockfile;
  /** absent on a first run */
  previous?: Lockfile;
  disk: DiskScan;
  expected: Operation[];
}

const plannerFixtureSchema = z.object({
  name: z.string(),
  current: LockfileSchema,
  previous: LockfileSchema.optional(),
  disk: DiskScanSchema,
  expected: z.array(OperationSchema),
});

// typecheck fails when the schema and its type drift apart
type _PlannerFixtureMatches = Assert<
  MutuallyAssignable<z.infer<typeof plannerFixtureSchema>, PlannerFixture>
>;

export const PlannerFixtureSchema: z.ZodType<PlannerFixture> = plannerFixtureSchema;
