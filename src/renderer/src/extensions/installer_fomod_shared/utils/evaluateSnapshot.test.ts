import { describe, expect, it } from "vitest";

import type { ConditionSnapshot, OptionSnapshot } from "../types/snapshot";
import {
  becameUsable,
  evaluateCondition,
  type IEvaluationContext,
  resolveOptionPattern,
  resolveOptionType,
} from "./evaluateSnapshot";

const plugin = (path: string, state: "Missing" | "Inactive" | "Active"): ConditionSnapshot => ({
  kind: "Plugin",
  pluginPath: path,
  pluginState: state,
});

const flag = (name: string, value: string): ConditionSnapshot => ({
  kind: "Flag",
  flagName: name,
  flagValue: value,
});

const composite = (
  operator: "And" | "Or",
  ...conditions: ConditionSnapshot[]
): ConditionSnapshot => ({ kind: "Composite", operator, conditions });

const environment: ConditionSnapshot = {
  kind: "Environment",
  environmentType: "GameVersion",
  minimumVersion: "99.0.0",
};

const context = (
  plugins: Record<string, "Missing" | "Inactive" | "Active"> = {},
  flags: Record<string, string> = {},
): IEvaluationContext => ({
  pluginState: (path) => plugins[path.toLowerCase()],
  flagValue: (name) => flags[name],
});

const option = (overrides: Partial<OptionSnapshot>): OptionSnapshot => ({
  name: "Patch for Mod B",
  type: "NotUsable",
  selected: false,
  resolver: { kind: "Conditional", defaultType: "NotUsable", patterns: [] },
  flags: [],
  ...overrides,
});

describe("evaluateCondition", () => {
  it("fulfils a plugin condition when the plugin is in the required state", () => {
    expect(evaluateCondition(plugin("b.esp", "Active"), context({ "b.esp": "Active" }))).toBe(
      "True",
    );
  });

  it("fails a plugin condition when the plugin is present but not active", () => {
    expect(evaluateCondition(plugin("b.esp", "Active"), context({ "b.esp": "Inactive" }))).toBe(
      "False",
    );
  });

  it("fulfils a Missing condition when no plugin management reports the plugin", () => {
    // A game with no plugin management cannot have the plugin, which is a real answer.
    expect(evaluateCondition(plugin("b.esp", "Missing"), context())).toBe("True");
  });

  it("fails an Active condition when no plugin management reports the plugin", () => {
    expect(evaluateCondition(plugin("b.esp", "Active"), context())).toBe("False");
  });

  it("fulfils a flag condition on a matching value", () => {
    expect(evaluateCondition(flag("patches", "enabled"), context({}, { patches: "enabled" }))).toBe(
      "True",
    );
  });

  it("fulfils an empty flag condition when the flag is unset", () => {
    expect(evaluateCondition(flag("patches", ""), context())).toBe("True");
  });

  it("treats an environment condition as undecidable", () => {
    // The requirement is recorded but the version observed at install time is not, so
    // neither answer is available. Guessing false is the false alarm this avoids.
    expect(evaluateCondition(environment, context())).toBe("Undecidable");
  });

  it("treats an unknown condition kind as undecidable", () => {
    expect(evaluateCondition({ kind: "Unknown" }, context())).toBe("Undecidable");
  });

  it("settles an Or when a decided sibling is true", () => {
    expect(
      evaluateCondition(
        composite("Or", environment, plugin("b.esp", "Active")),
        context({ "b.esp": "Active" }),
      ),
    ).toBe("True");
  });

  it("settles an And when a decided sibling is false", () => {
    expect(
      evaluateCondition(composite("And", environment, plugin("b.esp", "Active")), context()),
    ).toBe("False");
  });

  it("stays undecidable when no sibling decides it", () => {
    expect(
      evaluateCondition(composite("Or", environment, plugin("b.esp", "Active")), context()),
    ).toBe("Undecidable");
  });
});

describe("resolveOptionType", () => {
  const gated = option({
    resolver: {
      kind: "Conditional",
      defaultType: "NotUsable",
      patterns: [{ type: "Required", condition: plugin("b.esp", "Active") }],
    },
  });

  it("returns the pattern's type when its condition is fulfilled", () => {
    expect(resolveOptionType(gated, context({ "b.esp": "Active" }))).toBe("Required");
  });

  it("falls through to the default when no pattern matches", () => {
    expect(resolveOptionType(gated, context())).toBe("NotUsable");
  });

  it("returns undefined when a pattern is undecidable", () => {
    // It may have been the first to match, so neither continuing nor falling through is
    // sound; the caller falls back to the recorded type.
    const undecidable = option({
      resolver: {
        kind: "Conditional",
        defaultType: "NotUsable",
        patterns: [{ type: "Required", condition: environment }],
      },
    });
    expect(resolveOptionType(undecidable, context())).toBeUndefined();
  });

  it("returns a static resolver's type", () => {
    const fixed = option({ resolver: { kind: "Static", type: "Optional" } });
    expect(resolveOptionType(fixed, context())).toBe("Optional");
  });
});

describe("resolveOptionPattern", () => {
  // The reason a user is shown names the plugin from the pattern that matched, so the walk
  // has to report which one that was rather than leaving the caller to guess.
  const alternatives = option({
    resolver: {
      kind: "Conditional",
      defaultType: "NotUsable",
      patterns: [
        { type: "Required", condition: plugin("x.esp", "Active") },
        { type: "Optional", condition: plugin("y.esp", "Active") },
      ],
    },
  });

  it("reports the pattern whose condition matched, not the first one listed", () => {
    const resolved = resolveOptionPattern(alternatives, context({ "y.esp": "Active" }));

    expect(resolved.type).toBe("Optional");
    expect(resolved.matchedPattern?.condition.pluginPath).toBe("y.esp");
  });

  it("reports no pattern when the resolver fell through to its default", () => {
    const resolved = resolveOptionPattern(alternatives, context());

    expect(resolved.type).toBe("NotUsable");
    expect(resolved.matchedPattern).toBeUndefined();
  });

  it("reports no pattern for a static resolver", () => {
    const fixed = option({ resolver: { kind: "Static", type: "Optional" } });
    expect(resolveOptionPattern(fixed, context()).matchedPattern).toBeUndefined();
  });
});

describe("becameUsable", () => {
  const gated = option({
    resolver: {
      kind: "Conditional",
      defaultType: "NotUsable",
      patterns: [{ type: "Required", condition: plugin("b.esp", "Active") }],
    },
  });

  it("reports an option that was unusable and is now usable", () => {
    expect(becameUsable(gated, context({ "b.esp": "Active" }))).toBe(true);
  });

  it("does not report an option that is still unusable", () => {
    expect(becameUsable(gated, context())).toBe(false);
  });

  it("does not report an option the user already selected", () => {
    // Telling someone to reinstall for what they already have is worse than silence.
    const selected = { ...gated, selected: true };
    expect(becameUsable(selected, context({ "b.esp": "Active" }))).toBe(false);
  });

  it("does not report an option that was already usable", () => {
    const alreadyUsable = { ...gated, type: "Optional" as const };
    expect(becameUsable(alreadyUsable, context({ "b.esp": "Active" }))).toBe(false);
  });

  it("does not report an option whose condition is undecidable", () => {
    const undecidable = option({
      resolver: {
        kind: "Conditional",
        defaultType: "NotUsable",
        patterns: [{ type: "Required", condition: environment }],
      },
    });
    expect(becameUsable(undecidable, context())).toBe(false);
  });
});
