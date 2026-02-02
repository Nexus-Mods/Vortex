import { IConflict } from "../types/IConflict";

import { types, util } from "vortex-api";

export type RuleChoice = undefined | "before" | "after" | "conflicts";

function getRuleTypes(
  modId: string,
  mods: { [modId: string]: types.IMod },
  conflicts: IConflict[],
) {
  const res: { [modId: string]: RuleChoice } = {};
  if (mods[modId] === undefined) {
    // can this even happen?
    return res;
  }

  conflicts.forEach((conflict) => {
    const existingRule = (mods[modId].rules || []).find(
      (rule) =>
        ["before", "after", "conflicts"].indexOf(rule.type) !== -1 &&
        (util as any).testModReference(conflict.otherMod, rule.reference),
    );

    res[conflict.otherMod.id] =
      existingRule !== undefined
        ? (existingRule.type as RuleChoice)
        : undefined;
  });
  return res;
}

export default getRuleTypes;
