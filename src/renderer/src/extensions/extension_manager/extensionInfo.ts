import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import type { ExtensionInfo, IAvailableExtension } from "@/types/extensions";
import type { IExtensionState } from "@/types/IState";

const schema = z.looseObject({
  name: z.string(),
  author: z.string().optional(),
  description: z.string().optional(),
  version: z.string(),
  id: z.string().optional(),
  namespace: z.string().optional(),
});

export function readExtensionInfo(extensionPath: string): Promise<string> {
  const infoJsonPath = join(extensionPath, "info.json");
  return readFile(infoJsonPath, { encoding: "utf8" });
}

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

export function infoToState(
  info: ExtensionInfo,
  extensionPath: string,
  catalogEntry?: IAvailableExtension,
): IExtensionState {
  const result: IExtensionState = {
    name: catalogEntry?.name ?? info.name,
    author: catalogEntry?.author ?? info.author,
    description: catalogEntry?.description?.short ?? info.description,
    version: catalogEntry?.version ?? info.version,

    endorsed: "Undecided",
    remove: false,
    enabled: true,
    path: extensionPath,

    infoJsonId: info.id,

    modId: catalogEntry?.modId,
    fileId: catalogEntry?.fileId,
    type: catalogEntry?.type,
  };

  return result;
}
