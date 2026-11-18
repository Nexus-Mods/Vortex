import type { VortexGameId } from "@vortex/shared";
import type { Action } from "redux";

import { setDownloadModInfo } from "@/extensions/download_management/actions/state";

import { setModAttribute } from "../../actions/mods";
import type { IMod } from "../../types/IMod";

/** The attributes a user sets on mods, by where a downloaded mod's download keeps each. */
const DOWNLOAD_KEYS = {
  category: "custom.category",
  source: "source",
} as const;

/** An attribute a user can set on mods, downloaded or installed. */
export type ModEditableAttribute = keyof typeof DOWNLOAD_KEYS;

/**
 * The actions that set an attribute on mods: on an installed mod itself, and on a downloaded
 * one's download, as a mod that's only downloaded has no entry of its own to keep it in yet.
 */
export const modAttributeActions = (
  gameId: VortexGameId,
  mods: IMod[],
  attribute: ModEditableAttribute,
  value: string | undefined,
): Action[] =>
  mods.map((mod) =>
    mod.state === "downloaded"
      ? setDownloadModInfo(mod.id, DOWNLOAD_KEYS[attribute], value)
      : setModAttribute(gameId, mod.id, attribute, value),
  );
