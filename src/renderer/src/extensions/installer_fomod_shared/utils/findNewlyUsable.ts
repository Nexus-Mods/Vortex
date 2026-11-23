import type {
  FlagSnapshot,
  GroupSnapshot,
  InstallSnapshot,
  OptionSnapshot,
  OptionType,
  StepSnapshot,
} from "../types/snapshot";
import { becameUsable, type IEvaluationContext, resolveOptionType } from "./evaluateSnapshot";

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
 * Render the condition that made an option usable, for a user rather than a developer.
 *
 * Returns undefined when nothing in the tree can be named - an option that became usable
 * through a flag, say, where the flag's owner is the more useful thing to name and the
 * caller supplies that.
 */
const describeCondition = (option: OptionSnapshot): string | undefined => {
  for (const pattern of option.resolver.patterns ?? []) {
    const named = pattern.condition.conditions ?? [pattern.condition];
    const plugin = named.find((node) => node.kind === "Plugin" && node.pluginPath !== undefined);
    if (plugin !== undefined) {
      return plugin.pluginPath;
    }
  }
  return undefined;
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
      const nowType = resolveOptionType(option, context);
      if (nowType === undefined) {
        continue;
      }
      const named = describeCondition(option);
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
    // An invisible step's options are not offered to the user at all, so an option inside
    // one becoming usable is not something they can act on.
    if (!step.visible) {
      continue;
    }
    for (const group of step.groups) {
      visitGroup(step, group);
    }
  }

  return found;
};

/**
 * The flag values in effect for a snapshot, replayed from the options it records as
 * selected.
 *
 * Starts from the flags the installer recorded at completion and layers the selected
 * options' own flags over them, so a consumer can evaluate flag conditions without
 * re-running the installer's selection logic.
 */
export const replayFlags = (snapshot: InstallSnapshot): Map<string, string> => {
  const values = new Map<string, string>();
  const record = (flags: FlagSnapshot[]): void => {
    for (const flag of flags) {
      values.set(flag.name, flag.value);
    }
  };

  record(snapshot.flags);
  for (const step of snapshot.steps) {
    for (const group of step.groups) {
      for (const option of group.options) {
        if (option.selected) {
          record(option.flags);
        }
      }
    }
  }
  return values;
};
