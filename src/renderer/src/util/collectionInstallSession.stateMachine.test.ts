import type { Store } from "redux";
/**
 * Session state-machine contract.
 *
 * This is the keystone of the install-reliability suite: it dispatches the EXACT
 * typed actions that InstallManager / InstallDriver dispatch against the real
 * install-tracking reducer, then asserts completion through the production
 * selectors. It defines the behaviour the write-path refactor must satisfy - no
 * Electron, fs, installers, or events involved.
 *
 * Scenarios locked in here (from the LAZ-483 matrix): happy path, a failed
 * required mod still completing, a skipped/ignored required mod honoured, optional
 * mods never blocking completion, in-progress not yet complete, restart
 * rehydration reaching the same completion, and interleaved (concurrent) updates
 * keeping the aggregate counters and isComplete correct.
 */
import { describe, expect, it } from "vitest";

import {
  finishInstallSession,
  markModInstalled,
  startInstallSession,
  updateModStatus,
} from "../actions/collectionInstallTracking";
import { makeMod, makeRule, modsByRule } from "../test-utils/builders";
import { asIState, createSessionStore } from "../test-utils/sessionStore";
import type {
  CollectionModStatus,
  ICollectionInstallState,
  ICollectionModInstallInfo,
} from "../types/collections/ICollectionInstallSession";
import { modRuleId, reconstructModStatus } from "./collectionInstallSession";
import {
  getCollectionActiveSession,
  getCollectionInstallProgress,
  getCollectionStatusBreakdown,
} from "./collectionInstallSessionSelectors";

const GAME = "skyrimse";

/** Start a session for the given mods and return the (reducer-computed) session id. */
function startSession(
  store: Store<ICollectionInstallState>,
  mods: Record<string, ICollectionModInstallInfo>,
  opts: { collectionId?: string; profileId?: string } = {},
): string {
  const collectionId = opts.collectionId ?? "col1";
  const profileId = opts.profileId ?? "prof1";
  const all = Object.values(mods);
  store.dispatch(
    startInstallSession({
      // the reducer recomputes sessionId from collectionId+profileId; passed only
      // to satisfy the payload type
      sessionId: `${collectionId}_${profileId}`,
      collectionId,
      profileId,
      gameId: GAME,
      mods,
      totalRequired: all.filter((m) => m.type === "requires").length,
      totalOptional: all.filter((m) => m.type === "recommends").length,
    }),
  );
  return `${collectionId}_${profileId}`;
}

describe("collection install session state machine", () => {
  const progressOf = (store: Store<ICollectionInstallState>) =>
    getCollectionInstallProgress(asIState(store.getState()));

  it("reaches isComplete once every required mod is installed (happy path)", () => {
    const store = createSessionStore();
    const sessionId = startSession(
      store,
      modsByRule([
        { ruleId: "r1", type: "requires" },
        { ruleId: "r2", type: "requires" },
      ]),
    );

    expect(progressOf(store)!.isComplete).toBe(false);

    store.dispatch(updateModStatus(sessionId, "r1", "installing"));
    store.dispatch(markModInstalled(sessionId, "r1", "mod-1"));
    expect(progressOf(store)!.isComplete).toBe(false);
    expect(progressOf(store)!.installProgress).toBe(50);

    store.dispatch(markModInstalled(sessionId, "r2", "mod-2"));

    const progress = progressOf(store)!;
    expect(progress.isComplete).toBe(true);
    expect(progress.installProgress).toBe(100);
    expect(progress.installedCount).toBe(2);
  });

  it("a failed required mod still lets the collection complete (does not stick at 9X%)", () => {
    // The original stuck-at-9X% bug: a required mod that can never install leaves the
    // collection forever incomplete. A failed required mod is terminal and must count
    // toward completion (the install is "done", just not fully successful).
    const store = createSessionStore();
    const sessionId = startSession(
      store,
      modsByRule([
        { ruleId: "r1", type: "requires" },
        { ruleId: "r2", type: "requires" },
      ]),
    );

    store.dispatch(markModInstalled(sessionId, "r1", "mod-1"));
    store.dispatch(updateModStatus(sessionId, "r2", "failed"));

    const progress = progressOf(store)!;
    expect(progress.isComplete).toBe(true);
    expect(progress.failedCount).toBe(1);
    // only one of two required mods actually installed
    expect(progress.installProgress).toBe(50);
  });

  it("a skipped (ignored) required mod is honoured and counts toward completion", () => {
    const store = createSessionStore();
    const sessionId = startSession(
      store,
      modsByRule([
        { ruleId: "r1", type: "requires" },
        { ruleId: "r2", type: "requires" },
      ]),
    );

    store.dispatch(markModInstalled(sessionId, "r1", "mod-1"));
    store.dispatch(updateModStatus(sessionId, "r2", "ignored"));

    const progress = progressOf(store)!;
    expect(progress.isComplete).toBe(true);
    expect(progress.ignoredCount).toBe(1);
  });

  it("optional (recommends) mods never block completion", () => {
    const store = createSessionStore();
    const sessionId = startSession(
      store,
      modsByRule([
        { ruleId: "req", type: "requires" },
        { ruleId: "opt", type: "recommends" },
      ]),
    );

    // the only required mod installs; the optional one stays pending
    store.dispatch(markModInstalled(sessionId, "req", "mod-req"));

    expect(progressOf(store)!.isComplete).toBe(true);
  });

  it("is not complete while a required mod is still in progress", () => {
    const store = createSessionStore();
    const sessionId = startSession(
      store,
      modsByRule([
        { ruleId: "r1", type: "requires" },
        { ruleId: "r2", type: "requires" },
      ]),
    );

    store.dispatch(markModInstalled(sessionId, "r1", "mod-1"));
    store.dispatch(updateModStatus(sessionId, "r2", "installing"));

    expect(progressOf(store)!.isComplete).toBe(false);
  });

  it("keeps the status breakdown consistent under interleaved updates", () => {
    const store = createSessionStore();
    const sessionId = startSession(
      store,
      modsByRule([
        { ruleId: "r1", type: "requires" },
        { ruleId: "r2", type: "requires" },
        { ruleId: "r3", type: "requires" },
      ]),
    );

    // interleave transitions the way concurrent installers would
    store.dispatch(updateModStatus(sessionId, "r1", "downloading"));
    store.dispatch(updateModStatus(sessionId, "r2", "downloading"));
    store.dispatch(updateModStatus(sessionId, "r1", "installing"));
    store.dispatch(updateModStatus(sessionId, "r3", "downloading"));
    store.dispatch(markModInstalled(sessionId, "r1", "mod-1"));
    store.dispatch(updateModStatus(sessionId, "r2", "installing"));
    store.dispatch(markModInstalled(sessionId, "r2", "mod-2"));

    const breakdown = getCollectionStatusBreakdown(asIState(store.getState()), sessionId);
    expect(breakdown.required.installed).toBe(2);
    expect(breakdown.required.downloading).toBe(1); // r3
    // the two installed plus the one still downloading account for all three
    const requiredTotal = Object.values(breakdown.required).reduce((a, b) => a + b, 0);
    expect(requiredTotal).toBe(3);
  });

  it("archives the session to history on finish", () => {
    const store = createSessionStore();
    const sessionId = startSession(store, modsByRule([{ ruleId: "r1", type: "requires" }]));
    store.dispatch(markModInstalled(sessionId, "r1", "mod-1"));
    store.dispatch(finishInstallSession(sessionId, true));

    const state = asIState(store.getState());
    expect(getCollectionActiveSession(state)).toBeUndefined();
    expect(store.getState().sessionHistory[sessionId]).toBeDefined();
  });

  it("rehydrates after a restart to the same completion (skip survives, no session)", () => {
    // state.session.collections is not persisted, so on restart the session is rebuilt
    // from durable inputs via reconstructModStatus. A pre-restart collection that was
    // complete (one required installed, one required skipped) must rebuild to complete.
    const installedRule = makeRule({ reference: { tag: "r1" } });
    const skippedRule = makeRule({ reference: { tag: "r2" }, ignored: true });

    const rebuiltStatus = (rule: typeof installedRule, mod?: ReturnType<typeof makeMod>) =>
      reconstructModStatus(rule, mod, undefined);

    const mods: Record<string, ICollectionModInstallInfo> = {
      [modRuleId(installedRule)]: {
        rule: installedRule,
        type: "requires",
        status: rebuiltStatus(
          installedRule,
          makeMod({ state: "installed" }),
        ) as CollectionModStatus,
      },
      [modRuleId(skippedRule)]: {
        rule: skippedRule,
        type: "requires",
        // skipped required mod rehydrates as terminal "ignored", not "pending"
        status: rebuiltStatus(skippedRule) as CollectionModStatus,
      },
    };

    const store = createSessionStore();
    const sessionId = startSession(store, mods);
    // mark the installed one as installed (markModInstalled is what sets the count)
    store.dispatch(markModInstalled(sessionId, modRuleId(installedRule), "mod-1"));

    const progress = progressOf(store)!;
    expect(mods[modRuleId(skippedRule)].status).toBe("ignored");
    expect(progress.isComplete).toBe(true);
  });
});
