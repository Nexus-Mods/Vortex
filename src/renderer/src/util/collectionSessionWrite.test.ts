/**
 * Unit coverage for the install-session WRITE side: the pure write planner and the
 * reference->write resolver against an active session.
 */
import { describe, expect, it } from "vitest";

import {
  makeInstallState,
  makeModInstallInfo,
  makeReference,
  makeRule,
  makeSession,
} from "../test-utils/builders";
import { asIState } from "../test-utils/sessionStore";
import type {
  CollectionModStatus,
  ICollectionModInstallInfo,
} from "../types/collections/ICollectionInstallSession";
import { planSessionWrite, sessionWriteForDependency } from "./collectionSessionWrite";

describe("planSessionWrite", () => {
  it("records reaching installed via markInstalled, over any in-progress or failed state", () => {
    expect(planSessionWrite("pending", { type: "installed", modId: "m1" })).toEqual({
      kind: "markInstalled",
      modId: "m1",
    });
    expect(planSessionWrite("failed", { type: "installed", modId: "m1" })).toEqual({
      kind: "markInstalled",
      modId: "m1",
    });
  });

  it("does NOT let an automatic installed override a user ignore (ignore is final)", () => {
    expect(planSessionWrite("ignored", { type: "installed", modId: "m1" })).toEqual({
      kind: "none",
    });
  });

  it("does not override a user ignore with an automatic in-progress status", () => {
    expect(planSessionWrite("ignored", { type: "status", status: "downloading" })).toEqual({
      kind: "none",
    });
  });

  it("writes an in-progress status when the mod is pending / in-progress", () => {
    expect(planSessionWrite("pending", { type: "status", status: "downloading" })).toEqual({
      kind: "updateStatus",
      status: "downloading",
    });
    expect(planSessionWrite(undefined, { type: "status", status: "installing" })).toEqual({
      kind: "updateStatus",
      status: "installing",
    });
  });

  it("does not downgrade a completed install with a late in-progress event", () => {
    expect(planSessionWrite("installed", { type: "status", status: "downloading" })).toEqual({
      kind: "none",
    });
  });

  it("lets a failed mod revert when it is retried", () => {
    // failed is not sticky: a requeue/retry must be able to move it forward again
    expect(planSessionWrite("failed", { type: "status", status: "installing" })).toEqual({
      kind: "updateStatus",
      status: "installing",
    });
  });
});

describe("sessionWriteForDependency", () => {
  // each session mod's rule reference carries a tag === ruleId; a dependency reference
  // carrying the same tag matches it by referenceId.
  const refForTag = (tag: string) => makeReference({ tag });

  function stateWith(
    entries: Array<{ ruleId: string; status?: CollectionModStatus }>,
  ): ReturnType<typeof asIState> {
    // keyed by ruleId
    const mods: Record<string, ICollectionModInstallInfo> = {};
    for (const e of entries) {
      mods[e.ruleId] = makeModInstallInfo({
        rule: makeRule({ reference: { tag: e.ruleId } }),
        status: e.status ?? "pending",
      });
    }
    return asIState(makeInstallState({ activeSession: makeSession({ mods }) }));
  }

  it("resolves an in-progress status write for the matched rule", () => {
    const state = stateWith([{ ruleId: "r1", status: "pending" }]);
    expect(
      sessionWriteForDependency(state, refForTag("r1"), { type: "status", status: "installing" }),
    ).toEqual({
      sessionId: "col1_prof1",
      ruleId: "r1",
      write: { kind: "updateStatus", status: "installing" },
    });
  });

  it("resolves a markInstalled write for an installed outcome", () => {
    const state = stateWith([{ ruleId: "r1", status: "downloading" }]);
    expect(
      sessionWriteForDependency(state, refForTag("r1"), { type: "installed", modId: "mod-1" }),
    ).toEqual({
      sessionId: "col1_prof1",
      ruleId: "r1",
      write: { kind: "markInstalled", modId: "mod-1" },
    });
  });

  it("returns null when there is no active session", () => {
    const empty = asIState(makeInstallState());
    expect(
      sessionWriteForDependency(empty, refForTag("r1"), { type: "status", status: "installing" }),
    ).toBeNull();
  });

  it("returns null when no rule matches the reference", () => {
    const state = stateWith([{ ruleId: "r1", status: "pending" }]);
    expect(
      sessionWriteForDependency(state, refForTag("nope"), { type: "status", status: "installing" }),
    ).toBeNull();
  });

  it("returns null when the write would override a user-ignored mod", () => {
    const state = stateWith([{ ruleId: "r1", status: "ignored" }]);
    expect(
      sessionWriteForDependency(state, refForTag("r1"), { type: "installed", modId: "mod-1" }),
    ).toBeNull();
  });
});
