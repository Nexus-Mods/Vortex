/**
 * Pure-unit coverage for the install-session progress selectors that the
 * state-machine contract suite does not exercise directly: per-phase progress
 * (getCollectionPhaseProgress) and the required/optional/total split
 * (getCollectionStatusBreakdown). These read a built session straight off the
 * state - no store, no dispatch.
 */
import { describe, expect, it } from "vitest";

import {
  makeInstallState,
  makeModInstallInfo,
  makeRule,
  makeSession,
} from "../test-utils/builders";
import { asIState } from "../test-utils/sessionStore";
import type {
  CollectionModStatus,
  ICollectionModInstallInfo,
} from "../types/collections/ICollectionInstallSession";
import {
  getCollectionPhaseProgress,
  getCollectionStatusBreakdown,
} from "./collectionInstallSessionSelectors";

interface Entry {
  ruleId: string;
  phase?: number;
  type?: "requires" | "recommends";
  status?: CollectionModStatus;
}

/** Build a state whose active session contains the given member mods. */
function stateWith(entries: Entry[]) {
  // keyed by ruleId
  const mods: Record<string, ICollectionModInstallInfo> = {};
  for (const e of entries) {
    mods[e.ruleId] = makeModInstallInfo({
      // phase is read off the rule via rulePhase(); tag keeps each rule distinct
      rule: makeRule({ phase: e.phase ?? 0, reference: { tag: e.ruleId } }),
      type: e.type ?? "requires",
      status: e.status ?? "pending",
    });
  }
  const all = Object.values(mods);
  return asIState(
    makeInstallState({
      activeSession: makeSession({
        mods,
        totalRequired: all.filter((m) => m.type === "requires").length,
        totalOptional: all.filter((m) => m.type === "recommends").length,
      }),
    }),
  );
}

describe("getCollectionPhaseProgress", () => {
  it("groups mods by phase and reports per-phase completion (required only)", () => {
    const state = stateWith([
      { ruleId: "r1", phase: 0, type: "requires", status: "installed" },
      { ruleId: "r2", phase: 0, type: "requires", status: "failed" },
      { ruleId: "r3", phase: 1, type: "requires", status: "pending" },
      { ruleId: "r4", phase: 1, type: "recommends", status: "pending" },
    ]);

    const phases = getCollectionPhaseProgress(state);
    expect(phases.map((p) => p.phase)).toEqual([0, 1]);

    const [p0, p1] = phases;
    // phase 0: one installed + one failed = both required terminal -> complete
    expect(p0.required).toBe(2);
    expect(p0.installed).toBe(1);
    expect(p0.failed).toBe(1);
    expect(p0.progress).toBe(100);
    expect(p0.isComplete).toBe(true);

    // phase 1: one required still pending (the recommends one does not count) -> incomplete
    expect(p1.required).toBe(1);
    expect(p1.optional).toBe(1);
    expect(p1.pending).toBe(1);
    expect(p1.progress).toBe(0);
    expect(p1.isComplete).toBe(false);
  });

  it("treats a phase of only optional mods as complete", () => {
    const state = stateWith([{ ruleId: "opt", phase: 0, type: "recommends", status: "pending" }]);
    const [p0] = getCollectionPhaseProgress(state);
    expect(p0.required).toBe(0);
    expect(p0.isComplete).toBe(true);
  });
});

describe("getCollectionStatusBreakdown", () => {
  it("splits counts across required, optional and total", () => {
    const state = stateWith([
      { ruleId: "r1", type: "requires", status: "installed" },
      { ruleId: "r2", type: "requires", status: "downloading" },
      { ruleId: "o1", type: "recommends", status: "installed" },
    ]);

    const breakdown = getCollectionStatusBreakdown(state, "col1_prof1");
    expect(breakdown.required.installed).toBe(1);
    expect(breakdown.required.downloading).toBe(1);
    expect(breakdown.optional.installed).toBe(1);
    expect(breakdown.total.installed).toBe(2);
    expect(breakdown.total.downloading).toBe(1);
  });
});
