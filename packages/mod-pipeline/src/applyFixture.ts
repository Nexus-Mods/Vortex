import { ApplyStatus, RefusalReason, type KeptFile } from "./apply";
import { AbsolutePathSchema } from "./pathKey";
import { KeptReason, OperationSchema, type Operation } from "./plan";
import type { FixtureDisk } from "./testApplyFiles";
import type { Assert, MutuallyAssignable } from "./typeChecks";
import { z } from "./zodJitless";

/** How a fixture's run ends; a run that doesn't apply leaves the disk as it found it. */
export type ApplyFixtureOutcome =
  | { status: typeof ApplyStatus.Applied; kept: KeptFile[]; disk: FixtureDisk }
  | { status: typeof ApplyStatus.RolledBack; failedAt: number }
  | { status: typeof ApplyStatus.Refused; reason: RefusalReason };

/** A disk, the operations Apply runs on it, and how the run must end. */
export interface ApplyFixture {
  /** the behaviour it proves; the test name */
  name: string;
  disk: FixtureDisk;
  /** staged paths by file hash; a file not listed has none */
  staged: Record<string, string>;
  operations: Operation[];
  expected: ApplyFixtureOutcome;
}

const fixtureDiskSchema = z.object({
  files: z.record(AbsolutePathSchema, z.string()),
  folders: z.array(AbsolutePathSchema).optional(),
});

const applyFixtureSchema = z.object({
  name: z.string(),
  disk: fixtureDiskSchema,
  staged: z.record(z.string(), AbsolutePathSchema),
  operations: z.array(OperationSchema),
  expected: z.discriminatedUnion("status", [
    z.object({
      status: z.literal(ApplyStatus.Applied),
      kept: z.array(
        z.object({
          destinationPath: AbsolutePathSchema,
          keptPath: AbsolutePathSchema,
          reason: z.enum(KeptReason),
        }),
      ),
      disk: fixtureDiskSchema,
    }),
    z.object({ status: z.literal(ApplyStatus.RolledBack), failedAt: z.number().int() }),
    z.object({ status: z.literal(ApplyStatus.Refused), reason: z.enum(RefusalReason) }),
  ]),
});

// typecheck fails when the schema and its type drift apart
type _ApplyFixtureMatches = Assert<
  MutuallyAssignable<z.infer<typeof applyFixtureSchema>, ApplyFixture>
>;

export const ApplyFixtureSchema: z.ZodType<ApplyFixture> = applyFixtureSchema;
