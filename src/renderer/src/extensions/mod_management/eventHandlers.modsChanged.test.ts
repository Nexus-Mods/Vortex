import { describe, expect, it, vi } from "vitest";

// util/Steam reaches this at import time, through the eventHandlers graph, and
// off Windows it resolves a Steam install from the home directory. There is no
// ApplicationData to read paths from here.
vi.mock("../../util/getVortexPath", () => ({ default: vi.fn(() => "/tmp") }));

import { makeExactRef, makeGameHarness, makeMod, makeRule } from "../../test-utils/builders";
import { onModsChanged } from "./eventHandlers";
import { deploymentReducer } from "./reducers/deployment";
import type { IModRule } from "./types/IMod";

const GAME = "skyrimse";
const MOD_ID = "mod-1";

const beforeRule = makeRule({ type: "before", reference: makeExactRef({ id: "mod-2" }) });
const afterRule = makeRule({ type: "after", reference: makeExactRef({ id: "mod-3" }) });

function changeRules(from: IModRule[], to: IModRule[]): boolean {
  const harness = makeGameHarness({ gameId: GAME }, [
    { path: ["persistent", "deployment"], reducer: deploymentReducer },
  ]);
  onModsChanged(
    harness.api,
    { [GAME]: { [MOD_ID]: makeMod({ id: MOD_ID, rules: from }) } },
    { [GAME]: { [MOD_ID]: makeMod({ id: MOD_ID, rules: to }) } },
  );
  return harness.getState().persistent.deployment.needToDeploy[GAME] === true;
}

describe("onModsChanged", () => {
  it("marks deployment necessary when a mod gains a load order rule", () => {
    expect(changeRules([beforeRule], [beforeRule, afterRule])).toBe(true);
  });

  it("leaves deployment alone when the load order rules are only reordered", () => {
    expect(changeRules([beforeRule, afterRule], [afterRule, beforeRule])).toBe(false);
  });

  it("leaves deployment alone when only a rule's match hints change", () => {
    const hinted = {
      ...beforeRule,
      reference: { ...beforeRule.reference, idHint: "mod-2", md5Hint: "hint-md5" },
    };
    expect(changeRules([beforeRule], [hinted])).toBe(false);
  });

  it("leaves deployment alone when only a rule's presentation details change", () => {
    const annotated = { ...beforeRule, extra: { name: "Patch" } };
    expect(changeRules([beforeRule], [annotated])).toBe(false);
  });

  it("leaves deployment alone when a rule's reference gains empty fields", () => {
    const padded = {
      ...beforeRule,
      reference: { ...beforeRule.reference, description: undefined, logicalFileName: null },
    };
    expect(changeRules([beforeRule], [padded])).toBe(false);
  });

  it("leaves deployment alone when only a dependency rule changes", () => {
    const requiresRule = makeRule({ type: "requires", reference: makeExactRef({ id: "mod-4" }) });
    expect(changeRules([beforeRule], [beforeRule, requiresRule])).toBe(false);
  });
});
