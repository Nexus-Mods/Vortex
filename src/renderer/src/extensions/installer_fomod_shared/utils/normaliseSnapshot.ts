import type {
  ConditionKind,
  ConditionOperator,
  ConditionSnapshot,
  EnvironmentType,
  FlagSnapshot,
  GroupSnapshot,
  InstallSnapshot,
  OptionSnapshot,
  OptionType,
  PatternSnapshot,
  PluginState,
  ResolverKind,
  ResolverSnapshot,
  StepSnapshot,
} from "../types/snapshot";

// The snapshot arrives in one of two casings. The native package camel-cases; the IPC
// transport serialises with Newtonsoft and no naming policy, so every field beneath the
// lower-case `optionSnapshot` key keeps its .NET name. Both are read here so nothing
// downstream has to know which transport an install went through.

type Wire = Record<string, unknown>;

const asWire = (value: unknown): Wire | undefined =>
  typeof value === "object" && value !== null ? (value as Wire) : undefined;

/** Read a field by its camelCase name, falling back to the PascalCase one. */
const field = (wire: Wire, name: string): unknown => {
  if (wire[name] !== undefined) {
    return wire[name];
  }
  const pascal = name.charAt(0).toUpperCase() + name.slice(1);
  return wire[pascal];
};

const str = (wire: Wire, name: string): string | undefined => {
  const value = field(wire, name);
  return typeof value === "string" ? value : undefined;
};

const bool = (wire: Wire, name: string): boolean => field(wire, name) === true;

const num = (wire: Wire, name: string): number => {
  const value = field(wire, name);
  return typeof value === "number" ? value : 0;
};

const list = (wire: Wire, name: string): Wire[] => {
  const value = field(wire, name);
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(asWire).filter((entry): entry is Wire => entry !== undefined);
};

const OPTION_TYPES: ReadonlySet<string> = new Set([
  "Required",
  "Optional",
  "Recommended",
  "NotUsable",
  "CouldBeUsable",
]);

const CONDITION_KINDS: ReadonlySet<string> = new Set([
  "Plugin",
  "Flag",
  "Composite",
  "Environment",
  "Unknown",
]);

const PLUGIN_STATES: ReadonlySet<string> = new Set(["Missing", "Inactive", "Active"]);

const ENVIRONMENT_TYPES: ReadonlySet<string> = new Set([
  "GameVersion",
  "ScriptExtender",
  "ModManager",
  "Version",
]);

const oneOf = <T extends string>(
  allowed: ReadonlySet<string>,
  value: string | undefined,
): T | undefined => (value !== undefined && allowed.has(value) ? (value as T) : undefined);

/**
 * Read an option type, or undefined when the value is not one this build knows.
 *
 * An unrecognised type is not coerced to a default: a consumer that guessed would
 * report drift that has not happened.
 */
const optionType = (value: string | undefined): OptionType | undefined =>
  oneOf<OptionType>(OPTION_TYPES, value);

const condition = (wire: Wire): ConditionSnapshot => {
  const kind = oneOf<ConditionKind>(CONDITION_KINDS, str(wire, "kind")) ?? "Unknown";
  const result: ConditionSnapshot = { kind };

  const pluginPath = str(wire, "pluginPath");
  if (pluginPath !== undefined) {
    result.pluginPath = pluginPath;
  }
  const pluginState = oneOf<PluginState>(PLUGIN_STATES, str(wire, "pluginState"));
  if (pluginState !== undefined) {
    result.pluginState = pluginState;
  }
  const flagName = str(wire, "flagName");
  if (flagName !== undefined) {
    result.flagName = flagName;
  }
  const flagValue = str(wire, "flagValue");
  if (flagValue !== undefined) {
    result.flagValue = flagValue;
  }
  const operator = str(wire, "operator");
  if (operator === "And" || operator === "Or") {
    result.operator = operator as ConditionOperator;
  }
  const environmentType = oneOf<EnvironmentType>(ENVIRONMENT_TYPES, str(wire, "environmentType"));
  if (environmentType !== undefined) {
    result.environmentType = environmentType;
  }
  const minimumVersion = str(wire, "minimumVersion");
  if (minimumVersion !== undefined) {
    result.minimumVersion = minimumVersion;
  }
  const extender = str(wire, "extender");
  if (extender !== undefined) {
    result.extender = extender;
  }
  const message = str(wire, "message");
  if (message !== undefined) {
    result.message = message;
  }

  const conditions = list(wire, "conditions");
  if (conditions.length > 0) {
    result.conditions = conditions.map(condition);
  }

  return result;
};

const pattern = (wire: Wire): PatternSnapshot => ({
  type: optionType(str(wire, "type")) ?? "Optional",
  condition: condition(asWire(field(wire, "condition")) ?? {}),
});

const resolver = (wire: Wire): ResolverSnapshot => {
  const kind = str(wire, "kind") === "Static" ? "Static" : "Conditional";
  const result: ResolverSnapshot = { kind: kind as ResolverKind };

  const type = optionType(str(wire, "type"));
  if (type !== undefined) {
    result.type = type;
  }
  const defaultType = optionType(str(wire, "defaultType"));
  if (defaultType !== undefined) {
    result.defaultType = defaultType;
  }
  const patterns = list(wire, "patterns");
  if (patterns.length > 0) {
    result.patterns = patterns.map(pattern);
  }

  return result;
};

const flags = (wire: Wire): FlagSnapshot[] =>
  list(wire, "flags")
    .map((entry) => ({ name: str(entry, "name") ?? "", value: str(entry, "value") ?? "" }))
    .filter((entry) => entry.name.length > 0);

const option = (wire: Wire): OptionSnapshot => ({
  name: str(wire, "name") ?? "",
  type: optionType(str(wire, "type")),
  selected: bool(wire, "selected"),
  resolver: resolver(asWire(field(wire, "resolver")) ?? {}),
  flags: flags(wire),
});

const group = (wire: Wire): GroupSnapshot => ({
  name: str(wire, "name") ?? "",
  type: str(wire, "type") ?? "",
  options: list(wire, "options").map(option),
});

const step = (wire: Wire): StepSnapshot => {
  const result: StepSnapshot = {
    id: num(wire, "id"),
    name: str(wire, "name") ?? "",
    visible: bool(wire, "visible"),
    groups: list(wire, "groups").map(group),
  };
  const visibility = asWire(field(wire, "visibilityCondition"));
  if (visibility !== undefined && Object.keys(visibility).length > 0) {
    result.visibilityCondition = condition(visibility);
  }
  return result;
};

/**
 * Normalise a snapshot from either transport into the internal form.
 *
 * Returns undefined when there is nothing usable to read, which is what an install from
 * an installer that predates the snapshot produces. Callers treat that as "no snapshot",
 * never as "no options".
 */
/**
 * Read the snapshot off an installer result of any transport.
 *
 * The result types in both installer packages predate the field, and the dependency that
 * carries them is bumped separately from this code. Reading it through here keeps the
 * consumer independent of that bump: when the typings catch up, this still works, and
 * until then nothing is cast and no declaration file is patched.
 *
 * TODO: delete once @nexusmods/fomod-installer-native is past 0.13.4, whose
 * dist/types/InstallResult.d.ts has no `optionSnapshot` - read `result.optionSnapshot`
 * directly then, and drop the `unknown` parameter this takes.
 */
export const readOptionSnapshot = (result: unknown): InstallSnapshot | undefined => {
  const wire = asWire(result);
  return wire === undefined ? undefined : normaliseSnapshot(field(wire, "optionSnapshot"));
};

export const normaliseSnapshot = (raw: unknown): InstallSnapshot | undefined => {
  const wire = asWire(raw);
  if (wire === undefined) {
    return undefined;
  }
  const steps = list(wire, "steps");
  if (steps.length === 0) {
    return undefined;
  }
  return {
    steps: steps.map(step),
    flags: flags(wire),
  };
};
