import { z } from "zod";

import type { ExtensionInfo } from "@/types/extensions";

import { log } from "../../logging";
import { ContributesSchema } from "./contributes";

const schema = z.looseObject({
  name: z.string(),
  author: z.string().optional(),
  description: z.string().optional(),
  version: z.string(),
  id: z.string().optional(),
  namespace: z.string().optional(),
  // an unusable value leaves the extension unlinked rather than unloadable
  modId: z.number().int().positive().optional().catch(undefined),
  // validated separately, an invalid value must not make the extension unloadable
  contributes: z.unknown().optional(),
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
    modId: parsed.modId,
  };

  if (parsed.contributes !== undefined) {
    const contributes = ContributesSchema.safeParse(parsed.contributes);
    if (contributes.success) {
      result.contributes = contributes.data;
    } else {
      // never reject the extension, it runs in legacy mode
      log("warn", "invalid contributes in extension info.json, loading in legacy mode", {
        extension: parsed.id ?? parsed.name,
        issues: z.prettifyError(contributes.error),
      });
    }
  }

  return result;
}
