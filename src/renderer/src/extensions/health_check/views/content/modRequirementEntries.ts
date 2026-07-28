import { hiddenModRequirements } from "../../selectors";
import type { IModRequirementExt } from "../../types";

/**
 * Listing-entry id for a mod requirement — also the issue_id the analytics events report,
 * so the bulk-install path can attribute an install to the same entry the listing shows.
 */
export const modEntryId = (mod: IModRequirementExt): string =>
  `${mod.requiredBy.modId}-${mod.uid || `${mod.gameId}-${mod.modId || mod.modName}`}`;

export const isModHidden = (
  state: Parameters<typeof hiddenModRequirements>[0],
  mod: IModRequirementExt,
): boolean => (hiddenModRequirements(state)[mod.requiredBy.modId] || []).includes(mod.id);
