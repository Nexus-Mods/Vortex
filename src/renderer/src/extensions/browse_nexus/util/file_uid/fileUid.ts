import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { makeFileUID } from "@/extensions/nexus_integration/util/UIDs";

/** The UID of a file of a Browse mod, by its game's Nexus Mods id, as 1-click tracks it. */
export const fileUidOf = (mod: ModSummary, fileId: number | string): string =>
  makeFileUID({ gameId: String(mod.game.id), fileId: String(fileId) });
