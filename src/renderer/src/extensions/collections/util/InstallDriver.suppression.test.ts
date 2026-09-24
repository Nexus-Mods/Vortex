/**
 * A collection install holds off the expensive checks (plugins-changed, mod-installed, …) while
 * it runs, through the test runner's withSuppressedTests. These tests drive the REAL driver
 * through the collection harness and check the hold is released however the install ends — and
 * that the checks it held off then run once, since suppressed events are dropped, not queued.
 *
 * The regression they pin: a *completed* install, closed from the review screen, never released
 * the hold, so no Missing Masters (or other plugins-changed) check ran again until Vortex
 * restarted.
 */
import { describe, expect, vi } from "vitest";

import { makeCollectionModInfo, makeDownload, makeRevision } from "../../../test-utils/builders";
import { test } from "../../../test-utils/collectionTest";
import type { ICollectionHarness } from "../../../test-utils/harnessTypes";

const GAME = "skyrimse";
const COLLECTION = "col-1";
const ARCHIVE = "dl-col-1";

function downloadOverride(gameVersions?: string[]) {
  const modInfo = makeCollectionModInfo({ collectionId: 1, revisionId: 2, gameId: GAME });
  if (gameVersions !== undefined) {
    // revision info carried on the download, so the driver reads it without a network fetch
    modInfo.nexus.revisionInfo = {
      modFiles: [],
      gameVersions: gameVersions.map((reference) => ({ reference })),
    };
  }
  return {
    downloads: {
      [ARCHIVE]: makeDownload({ id: ARCHIVE, state: "finished", modInfo }),
    },
  };
}

interface IRerun {
  event: string;
  delay: number | undefined;
  // holds still outstanding on that event when the re-run was requested. The real runner drops
  // a run while any hold is outstanding, so anything but 0 means the re-run is lost.
  heldAtEmit: number;
}

/**
 * Stands in for the test runner: counts holds per event and records re-run requests. `lowest`
 * is the smallest count any event reached; below 0 means a hold was released twice.
 */
function trackSuppression(h: ICollectionHarness) {
  const held: Record<string, number> = {};
  const reruns: IRerun[] = [];
  const counts = { lowest: 0 };
  const release = (test: string) => {
    held[test] -= 1;
    counts.lowest = Math.min(counts.lowest, held[test]);
  };
  (h.api.ext as Record<string, unknown>).withSuppressedTests = (
    tests: string[],
    cb: () => PromiseLike<void>,
  ) => {
    tests.forEach((test) => (held[test] = (held[test] ?? 0) + 1));
    return Promise.resolve(cb()).finally(() => tests.forEach(release));
  };
  h.api.events.on("trigger-test-run", (event: string, delay?: number) => {
    // only the events a hold covered; the driver emits others (collections-changed) itself
    if (event in held) {
      reruns.push({ event, delay, heldAtEmit: held[event] });
    }
  });
  return { held, reruns, counts };
}

/** Mark every member installed and let the driver reach its review step, without closing it. */
async function reachReview(h: ICollectionHarness, collectionId: string, recommendations: boolean) {
  h.setState((draft) => {
    const session = draft.session.collections.activeSession;
    for (const id of Object.keys(session?.mods ?? {})) {
      session.mods[id].status = "installed";
    }
  });
  h.emit("did-install-dependencies", GAME, collectionId, recommendations);
  // the recommendations pass sets the review step without firing onUpdate, so poll the step
  await vi.waitFor(() => expect(h.driver.step).toBe("review"));
}

/** Let the released hold's promise chain settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("InstallDriver check suppression", () => {
  test("a completed install releases the hold and re-runs the held-off checks", async ({
    makeCollection,
  }) => {
    const h = makeCollection(downloadOverride());
    const { held, reruns } = trackSuppression(h);

    await h.installRevision(makeRevision(1, [{ tag: "a" }], { collectionId: COLLECTION }));
    expect(held["plugins-changed"]).toBe(1);

    await h.completeActiveInstall();
    await settle();

    expect(held["plugins-changed"]).toBe(0);
    expect(held["mod-installed"]).toBe(0);
    expect(reruns).toEqual([
      { event: "plugins-changed", delay: 500, heldAtEmit: 0 },
      { event: "settings-changed", delay: 500, heldAtEmit: 0 },
      { event: "mod-activated", delay: 5000, heldAtEmit: 0 },
      { event: "mod-installed", delay: 5000, heldAtEmit: 0 },
    ]);
  });

  test("a cancelled install releases the hold", async ({ makeCollection }) => {
    const h = makeCollection(downloadOverride());
    const { held } = trackSuppression(h);

    await h.installRevision(makeRevision(1, [{ tag: "a" }], { collectionId: COLLECTION }));
    h.driver.cancel();
    await settle();

    expect(held["plugins-changed"]).toBe(0);
  });

  test("an install cancelled at the game-version prompt releases the hold", async ({
    makeCollection,
  }) => {
    const h = makeCollection(downloadOverride(["9.9.9"]));
    const { held, reruns } = trackSuppression(h);
    h.setNextDialog({ action: "Cancel", input: {} });

    await h.installRevision(makeRevision(1, [{ tag: "a" }], { collectionId: COLLECTION }));
    await settle();

    expect(h.dialogCalls.map((call) => call.title)).toContain("Game version mismatch");
    expect(held["plugins-changed"]).toBe(0);
    expect(reruns.map((rerun) => rerun.heldAtEmit)).toEqual([0, 0, 0, 0]);
  });

  test("a pause releases the hold once and resuming takes it again", async ({ makeCollection }) => {
    const h = makeCollection(downloadOverride());
    const { held, reruns, counts } = trackSuppression(h);
    const revision = makeRevision(1, [{ tag: "a" }], { collectionId: COLLECTION });

    await h.installRevision(revision);
    h.driver.pause("user");
    // a paused install that is then removed goes through onStop a second time
    h.driver.cancel();
    await settle();

    expect(held["plugins-changed"]).toBe(0);
    expect(reruns.map((rerun) => rerun.heldAtEmit)).toEqual([0, 0, 0, 0]);

    // Resume (the notification action and resume-collection) is driver.start again
    await h.installRevision(revision);
    expect(held["plugins-changed"]).toBe(1);

    await h.completeActiveInstall();
    await settle();

    expect(held["plugins-changed"]).toBe(0);
    expect(counts.lowest).toBe(0);
  });

  test("installing the optional mods from the review screen keeps the one hold", async ({
    makeCollection,
  }) => {
    const h = makeCollection(downloadOverride());
    const { held, reruns, counts } = trackSuppression(h);
    const revision = makeRevision(1, [{ tag: "a" }], { collectionId: COLLECTION });

    await h.installRevision(revision);
    await reachReview(h, revision.collection.id, false);

    // the review screen offers the optional mods again after each pass
    for (let pass = 0; pass < 2; pass += 1) {
      h.driver.installRecommended();
      expect(held["plugins-changed"]).toBe(1);
      await reachReview(h, revision.collection.id, true);
    }
    expect(reruns).toEqual([]);

    await h.driver.continue();
    await settle();

    expect(held["plugins-changed"]).toBe(0);
    expect(counts.lowest).toBe(0);
    expect(reruns.map((rerun) => rerun.event)).toEqual([
      "plugins-changed",
      "settings-changed",
      "mod-activated",
      "mod-installed",
    ]);
  });

  test("installing a second collection after the first does not stack holds", async ({
    makeCollection,
  }) => {
    const h = makeCollection(downloadOverride());
    const { held } = trackSuppression(h);

    await h.installRevision(makeRevision(1, [{ tag: "a" }], { collectionId: COLLECTION }));
    await h.completeActiveInstall();
    await settle();
    await h.installRevision(makeRevision(2, [{ tag: "b" }], { collectionId: COLLECTION }));

    expect(held["plugins-changed"]).toBe(1);

    await h.completeActiveInstall();
    await settle();

    expect(held["plugins-changed"]).toBe(0);
  });
});
