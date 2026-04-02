/**
 * Detects installed mods that should use the `sdvrootfolder` mod type.
 */
import { RelativePath } from "@vortex/paths";

import type { types } from "vortex-api";

import { MOD_MANIFEST } from "../common";

/**
 * Mod-type matcher for automatic `sdvrootfolder` classification.
 *
 * Detects root installs by looking for `Content/` copy destinations, while
 * still handling mixed archives that also include regular SMAPI content.
 */
export function isSdvRootFolderModType(instructions: types.IInstruction[]) {
  const destinations = instructions
    .filter((instr) => instr.type === "copy")
    .flatMap((instr) => {
      if (instr.destination === undefined) {
        return [];
      }

      try {
        return [RelativePath.make(instr.destination)];
      } catch {
        return [];
      }
    });

  const hasManifest = destinations.some((destination) =>
    RelativePath.basenameEqualsIgnoreCase(destination, MOD_MANIFEST),
  );
  const hasModsFolder = destinations.some(
    (destination) => RelativePath.segmentsIgnoreCase(destination)[0] === "mods",
  );
  const hasContentFolder = destinations.some(
    (destination) =>
      RelativePath.segmentsIgnoreCase(destination)[0] === "content",
  );

  return hasManifest
    ? Promise.resolve(hasContentFolder && hasModsFolder)
    : Promise.resolve(hasContentFolder);
}
