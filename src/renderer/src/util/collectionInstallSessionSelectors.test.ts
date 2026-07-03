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
  makeLookup,
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
  getCollectionInstallProgress,
  getCollectionModByReference,
  getCollectionPhaseProgress,
  getCollectionStatusBreakdown,
  getFailedOptionalMods,
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

describe("getCollectionInstallProgress optional handling", () => {
  it("excludes a default-skipped (ignored) optional from completion and progress", () => {
    const state = stateWith([
      { ruleId: "r1", type: "requires", status: "installed" },
      { ruleId: "o1", type: "recommends", status: "ignored" },
    ]);
    const p = getCollectionInstallProgress(state)!;
    expect(p.isComplete).toBe(true);
    expect(p.installProgress).toBe(100);
  });

  it("counts a selected (non-ignored) optional toward completion, inflating the denominator", () => {
    const state = stateWith([
      { ruleId: "r1", type: "requires", status: "installed" },
      { ruleId: "o1", type: "recommends", status: "pending" },
    ]);
    const p = getCollectionInstallProgress(state)!;
    // one of two effective members installed
    expect(p.isComplete).toBe(false);
    expect(p.installProgress).toBe(50);
  });

  it("completes once the selected optional also installs", () => {
    const state = stateWith([
      { ruleId: "r1", type: "requires", status: "installed" },
      { ruleId: "o1", type: "recommends", status: "installed" },
    ]);
    const p = getCollectionInstallProgress(state)!;
    expect(p.isComplete).toBe(true);
    expect(p.installProgress).toBe(100);
  });

  it("does not prematurely complete when an optional installs before the last required", () => {
    const state = stateWith([
      { ruleId: "r1", type: "requires", status: "installed" },
      { ruleId: "r2", type: "requires", status: "pending" },
      { ruleId: "o1", type: "recommends", status: "installed" },
    ]);
    expect(getCollectionInstallProgress(state)!.isComplete).toBe(false);
  });
});

describe("getFailedOptionalMods", () => {
  it("returns only optional members with a failed status", () => {
    const state = stateWith([
      { ruleId: "r1", type: "requires", status: "failed" },
      { ruleId: "o1", type: "recommends", status: "failed" },
      { ruleId: "o2", type: "recommends", status: "ignored" },
      { ruleId: "o3", type: "recommends", status: "installed" },
    ]);
    expect(getFailedOptionalMods(state).map((m) => m.rule.reference.tag)).toEqual(["o1"]);
  });
});

describe("getCollectionModByReference", () => {
  // build a session keyed by ruleId; each entry gives the rule's reference and optionally an
  // installed Vortex mod id or a bundled localPath
  function sessionWith(
    entries: Record<
      string,
      { reference?: Record<string, any>; modId?: string; localPath?: string }
    >,
  ) {
    const mods: Record<string, ICollectionModInstallInfo> = {};
    for (const [ruleId, e] of Object.entries(entries)) {
      mods[ruleId] = makeModInstallInfo({
        rule: makeRule({
          reference: e.reference ?? { tag: ruleId },
          ...(e.localPath != null ? { extra: { localPath: e.localPath } } : {}),
        }),
        modId: e.modId,
        status: "installed",
      });
    }
    return asIState(makeInstallState({ activeSession: makeSession({ mods }) }));
  }

  it("matches a session rule by its reference tag", () => {
    const state = sessionWith({ r1: { reference: { tag: "tag-1" } } });
    expect(getCollectionModByReference(state, makeLookup({ referenceTag: "tag-1" }))).toBeDefined();
  });

  it("matches an external reference by fileMD5", () => {
    const state = sessionWith({ r1: { reference: { fileMD5: "md5-aaa" } } });
    expect(getCollectionModByReference(state, makeLookup({ fileMD5: "md5-aaa" }))).toBeDefined();
  });

  it("matches a bundled mod by its archive file name", () => {
    const state = sessionWith({ r1: { localPath: "Bundled Mod.7z" } });
    expect(
      getCollectionModByReference(state, makeLookup({ fileName: "Bundled Mod.7z" })),
    ).toBeDefined();
  });

  it("returns undefined when no reference matches the lookup", () => {
    const state = sessionWith({ r1: { reference: { tag: "tag-1" } } });
    expect(
      getCollectionModByReference(state, makeLookup({ referenceTag: "other" })),
    ).toBeUndefined();
  });

  it("matches on reference identity, never the installed Vortex mod id", () => {
    // the entry's modId is the installed Vortex id; a lookup carrying that value (but not the
    // rule's reference) must NOT match - the removed fast-path used to compare exactly this
    const state = sessionWith({ r1: { reference: { tag: "tag-1" }, modId: "12345" } });
    expect(
      getCollectionModByReference(state, makeLookup({ referenceTag: "12345" })),
    ).toBeUndefined();
    expect(getCollectionModByReference(state, makeLookup({ referenceTag: "tag-1" }))?.modId).toBe(
      "12345",
    );
  });

  it("returns undefined when there is no active session", () => {
    const empty = asIState(makeInstallState());
    expect(
      getCollectionModByReference(empty, makeLookup({ referenceTag: "tag-1" })),
    ).toBeUndefined();
  });
});
