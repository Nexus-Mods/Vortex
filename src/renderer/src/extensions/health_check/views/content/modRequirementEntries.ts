import { hiddenModRequirements } from "../../selectors";
import type { IModRequirementExt } from "../../types";

export const isModHidden = (
  state: Parameters<typeof hiddenModRequirements>[0],
  mod: IModRequirementExt,
): boolean => (hiddenModRequirements(state)[mod.requiredBy.modId] || []).includes(mod.id);
