import type { VortexGameId } from "@vortex/shared";
import type { Action } from "redux";

import type { IMod } from "@/extensions/mod_management/types/IMod";
import { modAttributeActions } from "@/extensions/mod_management/util/mod_attribute_actions/modAttributeActions";

/**
 * The actions that set the category of mods from the classic details pane. Its clearable select
 * sends undefined to clear the category, and a category id may arrive as a number.
 */
export const categoryChangeActions = (
  gameId: VortexGameId,
  mods: IMod[],
  value: string | number | undefined,
): Action[] =>
  modAttributeActions(gameId, mods, "category", value === undefined ? undefined : String(value));
