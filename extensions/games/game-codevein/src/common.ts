import path from "path";

import { VortexGameId } from "@nexusmods/vortex-api";

// DAH! extension only support .pak mods.
export const MOD_FILE_EXT = ".pak";
export const GAME_ID = VortexGameId("codevein");
export const LO_FILE_NAME = "loadOrder.json";

export function modsRelPath() {
  return path.join("CodeVein", "content", "paks", "~mods");
}
