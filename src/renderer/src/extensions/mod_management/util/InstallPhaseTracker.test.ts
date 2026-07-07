/**
 * Unit coverage for InstallPhaseTracker - the per-collection phase-gating state extracted from
 * InstallManager. Focuses on the phase-set derivation and the sentinel-safe "mark earlier phases
 * finished" backfill, which are the fiddly bits the extraction exists to make testable in isolation.
 */
import { describe, expect, it } from "vitest";

import { makeRule } from "../../../test-utils/builders";
import { InstallPhaseTracker } from "./InstallPhaseTracker";
import { OPTIONAL_PHASE } from "./rulePhase";

describe("InstallPhaseTracker", () => {
  describe("entry lifecycle", () => {
    it("ensure creates an entry once and get returns the same instance", () => {
      const tracker = new InstallPhaseTracker();
      expect(tracker.has("col")).toBe(false);
      const entry = tracker.ensure("col");
      expect(tracker.has("col")).toBe(true);
      expect(tracker.ensure("col")).toBe(entry);
      expect(tracker.get("col")).toBe(entry);
    });

    it("delete removes the entry", () => {
      const tracker = new InstallPhaseTracker();
      tracker.ensure("col");
      tracker.delete("col");
      expect(tracker.has("col")).toBe(false);
      expect(tracker.get("col")).toBeUndefined();
    });
  });

  describe("phaseSet", () => {
    it("returns the distinct required phases, ascending", () => {
      const tracker = new InstallPhaseTracker();
      const rules = [
        makeRule({ type: "requires", phase: 2, reference: { tag: "a" } }),
        makeRule({ type: "requires", phase: 0, reference: { tag: "b" } }),
        makeRule({ type: "requires", phase: 2, reference: { tag: "c" } }),
      ];
      expect(tracker.phaseSet("col", rules)).toEqual([0, 2]);
    });

    it("maps every recommends rule to the single OPTIONAL_PHASE, regardless of authored phase", () => {
      const tracker = new InstallPhaseTracker();
      const rules = [
        makeRule({ type: "requires", phase: 0, reference: { tag: "req" } }),
        // authored phase is deliberately non-zero to prove it is ignored for optionals
        makeRule({ type: "recommends", phase: 1, reference: { tag: "opt1" } }),
        makeRule({ type: "recommends", phase: 5, reference: { tag: "opt2" } }),
      ];
      expect(tracker.phaseSet("col", rules)).toEqual([0, OPTIONAL_PHASE]);
    });

    it("caches the first result for the session (ignore/unignore never changes it)", () => {
      const tracker = new InstallPhaseTracker();
      tracker.ensure("col");
      const first = tracker.phaseSet("col", [makeRule({ type: "requires", phase: 0 })]);
      // a later call with a different rule set returns the cached value - the phase set is stable
      const second = tracker.phaseSet("col", [makeRule({ type: "requires", phase: 3 })]);
      expect(second).toBe(first);
      expect(second).toEqual([0]);
    });
  });

  describe("markPhasesBeforeFinished", () => {
    it("marks only the real phases that sort before the target", () => {
      const tracker = new InstallPhaseTracker();
      const rules = [
        makeRule({ type: "requires", phase: 0, reference: { tag: "a" } }),
        makeRule({ type: "requires", phase: 1, reference: { tag: "b" } }),
        makeRule({ type: "requires", phase: 2, reference: { tag: "c" } }),
      ];
      tracker.markPhasesBeforeFinished("col", 2, rules);
      const finished = tracker.get("col")!.downloadsFinished;
      expect([...finished].sort((x, y) => x - y)).toEqual([0, 1]);
    });

    it("never enumerates 0..OPTIONAL_PHASE - only the real earlier phases are marked", () => {
      const tracker = new InstallPhaseTracker();
      const rules = [
        makeRule({ type: "requires", phase: 0, reference: { tag: "a" } }),
        makeRule({ type: "requires", phase: 1, reference: { tag: "b" } }),
        makeRule({ type: "recommends", phase: 0, reference: { tag: "opt" } }),
      ];
      // target is the sentinel: the old integer backfill would have added 666 phantom phases
      tracker.markPhasesBeforeFinished("col", OPTIONAL_PHASE, rules);
      const finished = tracker.get("col")!.downloadsFinished;
      expect([...finished].sort((x, y) => x - y)).toEqual([0, 1]);
      expect(finished.has(OPTIONAL_PHASE)).toBe(false);
    });
  });
});
