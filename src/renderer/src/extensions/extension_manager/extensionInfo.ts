import { z } from "zod";

import type { ExtensionInfo } from "@/types/extensions";

const schema = z.looseObject({
  name: z.string(),
  author: z.string().optional(),
  description: z.string().optional(),
  version: z.string(),
  id: z.string().optional(),
  namespace: z.string().optional(),
});

export function parseExtensionInfo(data: unknown): ExtensionInfo {
  const parsed = schema.parse(data);

  const result: ExtensionInfo = {
    name: parsed.name,
    version: parsed.version,
    author: parsed.author ?? "<unknown>",
    description: parsed.description ?? "<missing>",
    id: parsed.id,
    namespace: parsed.namespace,
  };

  return result;
}
