import { z } from "zod";

import { deBOM } from "../../util/util";
import { resolveLoadOrderId } from "./registry";
import { loadOrderEntrySchema } from "./types/schemas";
import type { LoadOrder } from "./types/types";

export const LOAD_ORDER_FILE_VERSION = 1;

const loadOrderFileSchema = z.object({
  version: z.literal(LOAD_ORDER_FILE_VERSION),
  // absent for a bare list
  loadOrderId: z.string().optional(),
  entries: z.array(loadOrderEntrySchema),
});

export type ILoadOrderFile = z.infer<typeof loadOrderFileSchema>;

export function serializeLoadOrderFile(
  loadOrderId: string | undefined,
  entries: LoadOrder,
): string {
  return JSON.stringify(
    {
      version: LOAD_ORDER_FILE_VERSION,
      loadOrderId: resolveLoadOrderId(loadOrderId),
      entries,
    },
    null,
    2,
  );
}

export function parseLoadOrderFile(fileData: string): ILoadOrderFile {
  const raw: unknown = JSON.parse(deBOM(fileData));
  // A bare list is the unversioned file, which names no load order.
  const parsed = loadOrderFileSchema.safeParse(
    Array.isArray(raw) ? { version: LOAD_ORDER_FILE_VERSION, entries: raw } : raw,
  );
  if (!parsed.success) {
    throw new Error(`invalid load order file: ${parsed.error.message}`);
  }
  return parsed.data;
}

// True when a file names a load order other than the one it is imported into.
export function importedFromOtherLoadOrder(
  file: ILoadOrderFile,
  targetLoadOrderId: string | undefined,
): boolean {
  return (
    file.loadOrderId !== undefined && file.loadOrderId !== resolveLoadOrderId(targetLoadOrderId)
  );
}
