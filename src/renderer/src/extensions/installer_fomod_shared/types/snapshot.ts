// The structured option-condition snapshot the FOMOD installer returns with an install
// result (fomod-installer PR #56). It is what lets Vortex tell, long after an install
// finished, that an option which was unusable then has since become usable - without
// re-parsing ModuleConfig.xml and without a second implementation of the parser.
//
// The two transports disagree on casing, so nothing outside this module reads the wire
// shape directly. The native package camel-cases (`pluginPath`); the IPC transport
// serialises with Newtonsoft and no naming policy, so its payload is PascalCase
// (`PluginPath`) beneath a lower-case `optionSnapshot` key. `normaliseSnapshot` takes
// either and returns the same internal form.

export type OptionType = "Required" | "Optional" | "Recommended" | "NotUsable" | "CouldBeUsable";

export type ConditionKind = "Plugin" | "Flag" | "Composite" | "Environment" | "Unknown";

export type PluginState = "Missing" | "Inactive" | "Active";

export type ConditionOperator = "And" | "Or";

export type ResolverKind = "Static" | "Conditional";

export type EnvironmentType = "GameVersion" | "ScriptExtender" | "ModManager" | "Version";

/**
 * One node of a condition tree.
 *
 * A single flat shape with a `kind` discriminator rather than a union, so a consumer
 * meeting a `kind` it does not know can still read the rest of the record.
 */
export interface ConditionSnapshot {
  kind: ConditionKind;
  /** For `Plugin`: the plugin path the condition tests. */
  pluginPath?: string;
  /** For `Plugin`: the required state. */
  pluginState?: PluginState;
  /** For `Flag`: the flag name the condition tests. */
  flagName?: string;
  /** For `Flag`: the required value. Empty means fulfilled when the flag is unset or empty. */
  flagValue?: string;
  /** For `Composite`: the operator combining the sub-conditions. */
  operator?: ConditionOperator;
  /** For `Composite`: the sub-conditions, in evaluation order. */
  conditions?: ConditionSnapshot[];
  /** For `Environment`: which environment condition this is. */
  environmentType?: EnvironmentType;
  /** For `Environment`: the minimum version required, as declared. */
  minimumVersion?: string;
  /** For `Environment`: the script extender identifier (fose, nvse, f4se, skse). */
  extender?: string;
  /** The human-readable explanation this condition renders, when it renders one. */
  message?: string;
}

/** One entry of a conditional resolver's pattern list. */
export interface PatternSnapshot {
  type: OptionType;
  condition: ConditionSnapshot;
}

/**
 * The resolver that produced an option's type.
 *
 * Evaluation order for `Conditional`, matching the installer: walk `patterns` in order
 * and return the `type` of the first pattern whose `condition` is fulfilled. If none is
 * fulfilled, return `defaultType`.
 *
 * A condition may be undecidable from the snapshot alone - an `Environment` leaf, because
 * the version observed at install time is not recorded. Undecidability propagates, and a
 * pattern whose condition is undecidable makes the rest of the walk undecidable too,
 * because it may have been the first to match. A consumer that reaches one must return
 * the recorded `OptionSnapshot.type` rather than continuing or falling through.
 */
export interface ResolverSnapshot {
  kind: ResolverKind;
  /** For `Static`: the fixed option type. */
  type?: OptionType;
  /** For `Conditional`: the type returned when no pattern matches. */
  defaultType?: OptionType;
  /** For `Conditional`: the patterns, in the order they are evaluated. */
  patterns?: PatternSnapshot[];
}

/** A flag an option sets when it is enabled. */
export interface FlagSnapshot {
  name: string;
  value: string;
}

export interface OptionSnapshot {
  name: string;
  /** The option type the installer resolved for this option at the moment of install. */
  type?: OptionType;
  /** Whether the option was selected in the install that produced this snapshot. */
  selected: boolean;
  resolver: ResolverSnapshot;
  /** The flags this option sets when enabled. */
  flags: FlagSnapshot[];
}

export interface GroupSnapshot {
  name: string;
  type: string;
  options: OptionSnapshot[];
}

export interface StepSnapshot {
  id: number;
  name: string;
  visible: boolean;
  /** The condition governing the step's visibility, absent when it is always visible. */
  visibilityCondition?: ConditionSnapshot;
  groups: GroupSnapshot[];
}

export interface InstallSnapshot {
  steps: StepSnapshot[];
  /** The flag values in effect when the install completed. */
  flags: FlagSnapshot[];
}

export const OPTION_SNAPSHOT_ATTRIBUTE = "fomodOptionSnapshot";
