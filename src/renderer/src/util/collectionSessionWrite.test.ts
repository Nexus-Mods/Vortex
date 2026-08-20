/**
 * Unit coverage for the install-session WRITE side: the pure write planner and the
 * reference->write resolver against an active session.
 */
import { describe, expect, it } from "vitest";

import type { IModReference } from "../extensions/mod_management/types/IMod";
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
import {
  matchSessionRuleEntry,
  planDependencyErrorRecovery,
  planSessionWrite,
  sessionWriteForDependency,
} from "./collectionSessionWrite";

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

  // a dependency carries its member's session key (sessionRuleId), captured while its rule was in
  // hand, so a write still addresses the member when its reference identity drifts
  it("resolves the member named by rule id even when the reference identity differs", () => {
    const state = stateWith([{ ruleId: "r1", status: "downloaded" }]);
    expect(
      sessionWriteForDependency(
        state,
        refForTag("retagged"),
        { type: "installed", modId: "mod-1" },
        "r1",
      ),
    ).toEqual({
      sessionId: "col1_prof1",
      ruleId: "r1",
      write: { kind: "markInstalled", modId: "mod-1" },
    });
  });

  it("falls back to reference matching when the rule id is not tracked", () => {
    const state = stateWith([{ ruleId: "r1", status: "pending" }]);
    expect(
      sessionWriteForDependency(
        state,
        refForTag("r1"),
        { type: "status", status: "installing" },
        "stale-key",
      ),
    ).toEqual({
      sessionId: "col1_prof1",
      ruleId: "r1",
      write: { kind: "updateStatus", status: "installing" },
    });
  });

  it("returns null when the write would override a user-ignored mod", () => {
    const state = stateWith([{ ruleId: "r1", status: "ignored" }]);
    expect(
      sessionWriteForDependency(state, refForTag("r1"), { type: "installed", modId: "mod-1" }),
    ).toBeNull();
  });
});

describe("matchSessionRuleEntry", () => {
  const sessionWith = (refs: Record<string, IModReference>) =>
    makeSession({
      mods: Object.fromEntries(
        Object.entries(refs).map(([ruleId, reference]) => [
          ruleId,
          makeModInstallInfo({ rule: makeRule({ reference }) }),
        ]),
      ),
    });

  it("names the member a reference identifies", () => {
    const session = sessionWith({ r1: { tag: "r1" }, r2: { tag: "r2" } });
    expect(matchSessionRuleEntry(session, makeReference({ tag: "r2" }))?.[0]).toBe("r2");
  });

  it("names no member for a reference no member carries", () => {
    const session = sessionWith({ r1: { tag: "r1" } });
    expect(matchSessionRuleEntry(session, makeReference({ tag: "other" }))).toBeUndefined();
  });

  // an id-less reference would otherwise alias onto any other id-less member
  it("names no member for a reference with no identifying field", () => {
    const session = sessionWith({ r1: {} });
    expect(matchSessionRuleEntry(session, {})).toBeUndefined();
  });
});

describe("planDependencyErrorRecovery", () => {
  const base = {
    installCanceled: false,
    ruleIgnored: false,
    isCanceled: false,
    hasRetriesLeft: true,
  };

  it("leaves an explicitly skipped member alone (never requeue - that would re-prompt the skip)", () => {
    // even with retries available, an ignored member must not be resurrected
    expect(planDependencyErrorRecovery({ ...base, ruleIgnored: true, isCanceled: true })).toEqual({
      action: "leave",
    });
  });

  it("leaves members alone when the whole install was cancelled (resume rebuilds them)", () => {
    expect(
      planDependencyErrorRecovery({ ...base, installCanceled: true, isCanceled: true }),
    ).toEqual({ action: "leave" });
  });

  it("settles a member the user declined at a prompt as skipped, not requeued", () => {
    // the instructions dialog's Skip throws UserCanceled(skipped=true); requeueing would re-ask
    // the question the user just answered, and leaving it would park the member non-terminal
    expect(planDependencyErrorRecovery({ ...base, isCanceled: true, userSkipped: true })).toEqual({
      action: "skip",
    });
  });

  it("a whole-install cancel or a durable ignore still wins over userSkipped", () => {
    expect(
      planDependencyErrorRecovery({ ...base, installCanceled: true, userSkipped: true }),
    ).toEqual({ action: "leave" });
    expect(planDependencyErrorRecovery({ ...base, ruleIgnored: true, userSkipped: true })).toEqual({
      action: "leave",
    });
  });

  it("requeues a transient error while retries remain", () => {
    expect(planDependencyErrorRecovery({ ...base })).toEqual({ action: "requeue" });
  });

  it("requeues a download cancelled as collateral (canceled, not skipped, retries left)", () => {
    // the free-user skip cascade tears down sibling downloads; those are wanted mods, so retry
    expect(
      planDependencyErrorRecovery({ ...base, isCanceled: true, hasRetriesLeft: true }),
    ).toEqual({ action: "requeue" });
  });

  it("settles a genuine failure as failed and surfaces the error once retries are exhausted", () => {
    expect(planDependencyErrorRecovery({ ...base, hasRetriesLeft: false })).toEqual({
      action: "fail",
      showError: true,
    });
  });

  it("settles a cancellation as failed WITHOUT surfacing an error (cancel is not a failure)", () => {
    expect(
      planDependencyErrorRecovery({ ...base, isCanceled: true, hasRetriesLeft: false }),
    ).toEqual({ action: "fail", showError: false });
  });

  it("fails a non-retryable error immediately even with retries left (e.g. disk full)", () => {
    // a disk-full cannot succeed on retry, so settle now instead of burning the retry budget
    expect(
      planDependencyErrorRecovery({ ...base, nonRetryable: true, hasRetriesLeft: true }),
    ).toEqual({ action: "fail", showError: true });
  });

  it("still leaves a non-retryable error alone when the member is skipped or the install cancelled", () => {
    expect(planDependencyErrorRecovery({ ...base, nonRetryable: true, ruleIgnored: true })).toEqual(
      { action: "leave" },
    );
  });
});
