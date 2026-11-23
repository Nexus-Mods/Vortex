import type {
  ConditionSnapshot,
  OptionSnapshot,
  OptionType,
  PluginState,
  ResolverSnapshot,
} from "../types/snapshot";

/**
 * The answer to "is this condition fulfilled?".
 *
 * Three values, not two. `Undecidable` is what an environment condition resolves to: the
 * snapshot records the version the mod required but not the version the machine had, so
 * neither answer is available. Collapsing it to `false` would report an option the
 * installer found usable as having become unusable - the exact false alarm this whole
 * feature exists to avoid.
 */
export type Truth = "True" | "False" | "Undecidable";

/** What the evaluator can see of the world at check time. */
export interface IEvaluationContext {
  /**
   * Look up a plugin's state by the path a condition names.
   *
   * Returns undefined when the plugin is not known at all, which the caller decides how to
   * read - a game with no plugin management reports every plugin as missing rather than
   * unknown.
   */
  pluginState: (pluginPath: string) => PluginState | undefined;
  /** The current value of a flag, or undefined when it is unset. */
  flagValue: (flagName: string) => string | undefined;
}

const and = (values: Truth[]): Truth => {
  if (values.some((value) => value === "False")) {
    return "False";
  }
  return values.some((value) => value === "Undecidable") ? "Undecidable" : "True";
};

const or = (values: Truth[]): Truth => {
  if (values.some((value) => value === "True")) {
    return "True";
  }
  return values.some((value) => value === "Undecidable") ? "Undecidable" : "False";
};

const evaluatePlugin = (condition: ConditionSnapshot, context: IEvaluationContext): Truth => {
  const path = condition.pluginPath;
  const required = condition.pluginState;
  if (path === undefined || required === undefined) {
    // A plugin condition missing the path or the state it tests cannot be read; treat it
    // as undecidable rather than inventing an answer.
    return "Undecidable";
  }

  const actual = context.pluginState(path);
  if (actual === undefined) {
    // Nothing in the game manages plugins, so no plugin can be present. That is a real
    // answer, not an unknown one.
    return required === "Missing" ? "True" : "False";
  }
  return actual === required ? "True" : "False";
};

const evaluateFlag = (condition: ConditionSnapshot, context: IEvaluationContext): Truth => {
  const name = condition.flagName;
  if (name === undefined) {
    return "Undecidable";
  }
  const required = condition.flagValue ?? "";
  const actual = context.flagValue(name) ?? "";
  return actual === required ? "True" : "False";
};

/**
 * Evaluate one condition node.
 *
 * Undecidability propagates through a composite unless a decided sibling settles it: an
 * `Or` with a true child is true, an `And` with a false child is false.
 */
export const evaluateCondition = (
  condition: ConditionSnapshot,
  context: IEvaluationContext,
): Truth => {
  switch (condition.kind) {
    case "Plugin":
      return evaluatePlugin(condition, context);
    case "Flag":
      return evaluateFlag(condition, context);
    case "Composite": {
      const children = condition.conditions ?? [];
      if (children.length === 0) {
        return "Undecidable";
      }
      const results = children.map((child) => evaluateCondition(child, context));
      return condition.operator === "Or" ? or(results) : and(results);
    }
    case "Environment":
    case "Unknown":
    default:
      return "Undecidable";
  }
};

/**
 * Recompute the option type an installer would resolve now, or undefined when it cannot
 * be known.
 *
 * Mirrors `ConditionalOptionTypeResolver.ResolveOptionType`: walk the patterns in order and
 * return the type of the first whose condition is fulfilled, else the default type. A
 * pattern whose condition is undecidable stops the walk - it may have been the first to
 * match, so neither continuing nor falling through is sound - and the caller falls back to
 * the type recorded at install time.
 */
export const resolveOptionType = (
  option: OptionSnapshot,
  context: IEvaluationContext,
): OptionType | undefined => {
  const resolver = option.resolver;
  if (resolver.kind === "Static") {
    return resolver.type;
  }

  for (const pattern of resolver.patterns ?? []) {
    const fulfilled = evaluateCondition(pattern.condition, context);
    if (fulfilled === "Undecidable") {
      return undefined;
    }
    if (fulfilled === "True") {
      return pattern.type;
    }
  }
  return resolver.defaultType;
};

/** The types an option can be selected under, as opposed to refused. */
const USABLE: ReadonlySet<OptionType> = new Set<OptionType>([
  "Required",
  "Optional",
  "Recommended",
  "CouldBeUsable",
]);

export const isUsable = (type: OptionType | undefined): boolean =>
  type !== undefined && USABLE.has(type);

/**
 * Whether an option has become selectable since the install that recorded the snapshot.
 *
 * True only when the option was not usable then, is usable now, and the user did not
 * already select it. An option that was usable then and is usable now is not news, and a
 * selected option is already installed.
 */
export const becameUsable = (option: OptionSnapshot, context: IEvaluationContext): boolean => {
  if (option.selected) {
    return false;
  }
  const now = resolveOptionType(option, context);
  if (now === undefined) {
    return false;
  }
  return !isUsable(option.type) && isUsable(now);
};

export const resolverKind = (resolver: ResolverSnapshot): string => resolver.kind;
