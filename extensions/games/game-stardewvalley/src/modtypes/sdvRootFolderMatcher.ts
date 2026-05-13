/**
 * Detects installed mods that should use the `sdvrootfolder` mod type.
 */
import path from "path";

import type { types } from "vortex-api";

import { MOD_MANIFEST, MODS_REL_PATH } from "../common";

/**
 * Mod-type matcher for automatic `sdvrootfolder` classification.
 *
 * Detects root installs by looking for `Content/` copy destinations, while
 * still handling mixed archives that also include regular SMAPI content.
 */
export function isSdvRootFolderModType(instructions: types.IInstruction[]) {
  const copyInstructions = instructions.filter((instr) => instr.type === "copy");

  const hasManifest = copyInstructions.some(
    (instr) => instr.destination?.endsWith(MOD_MANIFEST) === true,
  );
  const hasModsFolder = copyInstructions.some(
    (instr) => instr.destination?.startsWith(MODS_REL_PATH + path.sep) === true,
  );
  const hasContentFolder = copyInstructions.some(
    (instr) => instr.destination?.startsWith("Content" + path.sep) === true,
  );

  return hasManifest
    ? Promise.resolve(hasContentFolder && hasModsFolder)
    : Promise.resolve(hasContentFolder);
}
