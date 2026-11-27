import type {
  ConditionSnapshot,
  GroupSnapshot,
  InstallSnapshot,
  OptionSnapshot,
  OptionType,
  StepSnapshot,
} from "../types/snapshot";
import {
  becameUsable,
  evaluateCondition,
  type IEvaluationContext,
  resolveOptionPattern,
} from "./evaluateSnapshot";

/** One option that has become selectable since the install that recorded the snapshot. */
export interface INewlyUsableOption {
  stepName: string;
  groupName: string;
  optionName: string;
  /** The type it resolved to at install time, which was not usable. */
  wasType: OptionType | undefined;
  /** The type it resolves to now. */
  nowType: OptionType;
  /**
   * The condition that changed, rendered for the user.
   *
   * Taken from the pattern that now matches, so it names the plugin or flag the option was
   * waiting on rather than restating the option's own description.
   */
  reason: string;
}

/**
 * The first plugin a condition tree names that is fulfilled now.
 *
 * Only a fulfilled leaf is worth naming: inside an `Or` the sibling that did not match
 * would be a plugin the user does not have, and telling them the option is available
 * because of it would be wrong.
 */
const pluginIn = (
  condition: ConditionSnapshot,
  context: IEvaluationContext,
): string | undefined => {
  if (condition.kind === "Plugin") {
    return evaluateCondition(condition, context) === "True" ? condition.pluginPath : undefined;
  }
  for (const child of condition.conditions ?? []) {
    const named = pluginIn(child, context);
    if (named !== undefined) {
      return named;
    }
  }
  return undefined;
};

/**
 * Render the condition that made an option usable, for a user rather than a developer.
 *
 * Reads the pattern the resolver actually elected, not the first pattern that happens to
 * name a plugin: a resolver listing several alternatives names the one that now matches,
 * which is the only one the user can act on.
 *
 * Returns undefined when nothing in the elected pattern can be named - an option that
 * became usable through a flag, say, or through falling through to its default type, where
 * the caller supplies the group name instead.
 */
const describeCondition = (
  option: OptionSnapshot,
  context: IEvaluationContext,
): string | undefined => {
  const { matchedPattern } = resolveOptionPattern(option, context);
  return matchedPattern === undefined ? undefined : pluginIn(matchedPattern.condition, context);
};

/**
 * Whether a step's options are offered to the user now.
 *
 * The snapshot records whether the step was visible at install time, which is not the same
 * question: a step gated on a plugin that has since been installed was hidden then and is
 * visible now, and the options inside it are exactly the ones the user could not reach.
 *
 * Falls back to the recorded answer when the condition cannot be decided from a snapshot,
 * which is what an environment condition is - guessing there would either raise a step the
 * installer never offered or hide one it did.
 */
const stepIsVisibleNow = (step: StepSnapshot, context: IEvaluationContext): boolean => {
  if (step.visibilityCondition === undefined) {
    return step.visible;
  }
  const now = evaluateCondition(step.visibilityCondition, context);
  return now === "Undecidable" ? step.visible : now === "True";
};

/**
 * Every option in the snapshot that has become selectable since it was recorded.
 *
 * Options the user already selected are skipped: they are installed, and telling someone
 * to reinstall a mod to get what they already have is worse than saying nothing.
 */
export const findNewlyUsable = (
  snapshot: InstallSnapshot,
  context: IEvaluationContext,
): INewlyUsableOption[] => {
  const found: INewlyUsableOption[] = [];

  const visitGroup = (step: StepSnapshot, group: GroupSnapshot): void => {
    for (const option of group.options) {
      if (!becameUsable(option, context)) {
        continue;
      }
      const nowType = resolveOptionPattern(option, context).type;
      if (nowType === undefined) {
        continue;
      }
      const named = describeCondition(option, context);
      found.push({
        stepName: step.name,
        groupName: group.name,
        optionName: option.name,
        wasType: option.type,
        nowType,
        reason: named ?? group.name,
      });
    }
  };

  for (const step of snapshot.steps) {
    // A step that is still invisible offers none of its options, so nothing inside it is
    // something the user can act on.
    if (!stepIsVisibleNow(step, context)) {
      continue;
    }
    for (const group of step.groups) {
      visitGroup(step, group);
    }
  }

  return found;
};
