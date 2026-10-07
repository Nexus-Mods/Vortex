import { z } from "zod";

import type { ILoadOrderEntry } from "./types";

// loose so that keys a game extension adds beside the known ones survive a round trip
export const loadOrderEntrySchema: z.ZodType<ILoadOrderEntry> = z.looseObject({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  locked: z.union([z.boolean(), z.enum(["true", "false", "always", "never"])]).optional(),
  modId: z.string().optional(),
  data: z.unknown().optional(),
});
