import { describe, expect, it } from "vitest";

import type {
  ConditionSnapshot,
  InstallSnapshot,
  OptionSnapshot,
  StepSnapshot,
} from "../types/snapshot";
import type { IEvaluationContext } from "./evaluateSnapshot";
import { findNewlyUsable } from "./findNewlyUsable";

const plugin = (path: string, state: "Missing" | "Inactive" | "Active"): ConditionSnapshot => ({
  kind: "Plugin",
  pluginPath: path,
  pluginState: state,
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

/** A context where every listed plugin is present and active. */
const context = (active: string[] = []): IEvaluationContext => ({
  pluginState: (path) => (active.includes(path.toLowerCase()) ? "Active" : "Missing"),
  flagValue: () => undefined,
});

const gatedOption = (overrides: Partial<OptionSnapshot> = {}): OptionSnapshot => ({
  name: "Patch",
  type: "NotUsable",
  selected: false,
  flags: [],
  resolver: {
    kind: "Conditional",
    defaultType: "NotUsable",
    patterns: [{ type: "Required", condition: plugin("b.esp", "Active") }],
  },
  ...overrides,
});

const step = (overrides: Partial<StepSnapshot> = {}): StepSnapshot => ({
  id: 0,
  name: "Compat",
  visible: true,
  groups: [{ name: "Patches", type: "SelectAny", options: [gatedOption()] }],
  ...overrides,
});

const snapshot = (steps: StepSnapshot[]): InstallSnapshot => ({ steps, flags: [] });

describe("findNewlyUsable", () => {
  it("reports an option that became usable, naming the plugin it waited on", () => {
    const found = findNewlyUsable(snapshot([step()]), context(["b.esp"]));

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      stepName: "Compat",
      groupName: "Patches",
      optionName: "Patch",
      wasType: "NotUsable",
      nowType: "Required",
      reason: "b.esp",
    });
  });

  it("names the plugin from the pattern that matched, not the first one listed", () => {
    // The bug this guards: with two alternatives, the user was told the option was
    // available because of the plugin they do not have.
    const twoAlternatives = gatedOption({
      resolver: {
        kind: "Conditional",
        defaultType: "NotUsable",
        patterns: [
          { type: "Required", condition: plugin("x.esp", "Active") },
          { type: "Optional", condition: plugin("y.esp", "Active") },
        ],
      },
    });

    const found = findNewlyUsable(
      snapshot([
        step({ groups: [{ name: "Patches", type: "SelectAny", options: [twoAlternatives] }] }),
      ]),
      context(["y.esp"]),
    );

    expect(found[0].reason).toBe("y.esp");
  });

  it("names only a plugin inside the matched pattern that is fulfilled now", () => {
    // An Or over two plugins: the one that is still missing must not be the one named.
    const either = gatedOption({
      resolver: {
        kind: "Conditional",
        defaultType: "NotUsable",
        patterns: [
          {
            type: "Required",
            condition: composite(
              "Or",
              plugin("missing.esp", "Active"),
              plugin("present.esp", "Active"),
            ),
          },
        ],
      },
    });

    const found = findNewlyUsable(
      snapshot([step({ groups: [{ name: "Patches", type: "SelectAny", options: [either] }] })]),
      context(["present.esp"]),
    );

    expect(found[0].reason).toBe("present.esp");
  });

  it("falls back to the group name when the option became usable through a flag", () => {
    const flagGated = gatedOption({
      resolver: {
        kind: "Conditional",
        defaultType: "NotUsable",
        patterns: [{ type: "Required", condition: { kind: "Flag", flagName: "f", flagValue: "" } }],
      },
    });

    const found = findNewlyUsable(
      snapshot([step({ groups: [{ name: "Patches", type: "SelectAny", options: [flagGated] }] })]),
      context(),
    );

    expect(found[0].reason).toBe("Patches");
  });

  it("skips an option the user already selected", () => {
    const selected = gatedOption({ selected: true });
    const found = findNewlyUsable(
      snapshot([step({ groups: [{ name: "Patches", type: "SelectAny", options: [selected] }] })]),
      context(["b.esp"]),
    );

    expect(found).toHaveLength(0);
  });

  it("reports options in a step that was hidden at install time and is visible now", () => {
    // The opposite direction from the feature's premise: the step itself was unreachable,
    // so its options were too, and they are exactly what the user could not pick.
    const hiddenThen = step({
      visible: false,
      visibilityCondition: plugin("b.esp", "Active"),
    });

    const found = findNewlyUsable(snapshot([hiddenThen]), context(["b.esp"]));

    expect(found).toHaveLength(1);
    expect(found[0].optionName).toBe("Patch");
  });

  it("skips a step that is still hidden", () => {
    const hidden = step({ visible: false, visibilityCondition: plugin("b.esp", "Active") });

    expect(findNewlyUsable(snapshot([hidden]), context())).toHaveLength(0);
  });

  it("keeps a step visible when its visibility condition cannot be decided", () => {
    // An environment condition is unreadable from a snapshot, so the recorded answer stands.
    const undecidable = step({ visible: true, visibilityCondition: environment });

    expect(findNewlyUsable(snapshot([undecidable]), context(["b.esp"]))).toHaveLength(1);
  });
});
