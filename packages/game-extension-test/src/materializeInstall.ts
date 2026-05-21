import type { IModCheckContext } from "./types";
import { lastSegment } from "./util";

/**
 * Convert an installer's IInstruction[] output into the IModCheckContext that
 * a per-mod healthcheck consumes.
 *
 * Copy instructions become the file list (with `destination` as path under the
 * mod root). Attribute instructions become the attributes map.
 */
export function materializeInstall(
  modId: string,
  instructions: Array<{
    type: string;
    destination?: string;
    key?: string;
    value?: unknown;
  }>,
  readFileForBasename: (basename: string) => Promise<Buffer>,
): IModCheckContext {
  const files: string[] = [];
  const attributes: Record<string, unknown> = {};
  for (const inst of instructions) {
    if (inst.type === "copy" && inst.destination) {
      files.push(inst.destination);
    } else if (inst.type === "attribute" && inst.key !== undefined) {
      attributes[inst.key] = inst.value;
    } else if (inst.type === "setmodtype") {
      attributes.modType = inst.value;
    }
    // generatefile, mkdir, etc. are ignored for now — extend as needed.
  }
  return {
    modId,
    files,
    readFile: (rel) => readFileForBasename(lastSegment(rel)),
    attributes,
  };
}
