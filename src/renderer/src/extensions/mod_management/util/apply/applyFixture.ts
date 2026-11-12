import { AbsolutePathSchema, KeptReason, OperationSchema } from "@nexusmods/mod-pipeline";
import { z } from "zod";

import { ApplyStatus, RefusalReason } from "./apply";

const fixtureDiskSchema = z.object({
  files: z.record(AbsolutePathSchema, z.string()),
  folders: z.array(AbsolutePathSchema).optional(),
});

/** A disk, the operations Apply runs on it, and how the run must end. */
export const ApplyFixtureSchema = z.object({
  /** the behaviour it proves; the test name */
  name: z.string(),
  disk: fixtureDiskSchema,
  /** staged paths by file hash; a file not listed has none */
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

export type ApplyFixture = z.infer<typeof ApplyFixtureSchema>;
