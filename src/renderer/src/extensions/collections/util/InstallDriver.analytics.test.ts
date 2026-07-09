/**
 * Analytics integration tests for InstallDriver: drive the REAL driver through the collection
 * harness (start / pause / cancel / complete) and assert the collection-install Mixpanel events it
 * emits, plus the durable start/pause/resume markers on the collection mod. Counts on the terminal
 * events are seeded on the session (the counters are InstallManager's responsibility, covered by
 * collectionInstallTracking.test.ts); here we verify the wiring and the start-vs-resume distinction.
 */
import { describe, expect } from "vitest";

import {
  makeCollectionModInfo,
  makeDownload,
  makeRevision,
  waitForDriverStep,
} from "../../../test-utils/builders";
import { test } from "../../../test-utils/collectionTest";
import type { ICollectionHarness } from "../../../test-utils/harnessTypes";
import type { MixpanelEvent } from "../../analytics/mixpanel/MixpanelEvents";

const GAME = "skyrimse";
const COLLECTION = "col-1";
const ARCHIVE = "dl-col-1"; // makeRevision derives archiveId as `dl-${collectionId}`

/** Seeds the collection-archive download so nexusIdsFromDownloadId resolves the collection ids. */
function downloadOverride() {
  return {
    downloads: {
      [ARCHIVE]: makeDownload({
        id: ARCHIVE,
        state: "finished",
        modInfo: makeCollectionModInfo({ collectionId: 1, revisionId: 2, gameId: GAME }),
      }),
    },
  };
}

function capture(h: ICollectionHarness): MixpanelEvent[] {
  const events: MixpanelEvent[] = [];
  h.api.events.on("analytics-track-mixpanel-event", (e: MixpanelEvent) => events.push(e));
  return events;
}
const names = (events: MixpanelEvent[]) => events.map((e) => e.eventName);
const attrs = (h: ICollectionHarness): Record<string, unknown> =>
  h.getState().persistent.mods[GAME][COLLECTION].attributes;

// Restart the same collection without re-seeding it (installRevision replaces the mod object,
// which would wipe the durable markers). This mirrors a real resume: driver.start on the existing
// collection mod, which reads the persisted installStartedAt marker to classify start vs resume.
const restart = (h: ICollectionHarness): Promise<void> =>
  h.driver.start(
    h.getState().persistent.profiles["prof-1"],
    h.getState().persistent.mods[GAME][COLLECTION],
  );

describe("InstallDriver collection analytics", () => {
  test("first start emits started and anchors the durable installStartedAt marker", async ({
    makeCollection,
  }) => {
    const h = makeCollection(downloadOverride());
    const events = capture(h);

    await h.installRevision(makeRevision(1, [{ tag: "a" }], { collectionId: COLLECTION }));

    expect(names(events)).toEqual(["collections_installation_started"]);
    expect(events[0].properties).toMatchObject({ collection_id: "1", revision_id: "2" });
    expect(typeof attrs(h).installStartedAt).toBe("number");
  });

  test("a second start after a pause emits resumed (not started) and bumps resume_count", async ({
    makeCollection,
  }) => {
    const h = makeCollection(downloadOverride());
    const events = capture(h);
    const rev = makeRevision(1, [{ tag: "a" }], { collectionId: COLLECTION });

    await h.installRevision(rev);
    h.driver.pause("logout");
    await restart(h);

    expect(names(events)).toEqual([
      "collections_installation_started",
      "collections_installation_paused",
      "collections_installation_resumed",
    ]);
    expect(events[2].properties).toMatchObject({ resume_count: 1 });
    expect(attrs(h).collectionResumeCount).toBe(1);
    // the start marker survives the pause so the second start is classified as a resume
    expect(typeof attrs(h).installStartedAt).toBe("number");
  });

  test("pause emits paused with its trigger and keeps the markers (resumable)", async ({
    makeCollection,
  }) => {
    const h = makeCollection(downloadOverride());
    const events = capture(h);

    await h.installRevision(makeRevision(1, [{ tag: "a" }], { collectionId: COLLECTION }));
    h.driver.pause("gamemode-changed");

    const paused = events.find((e) => e.eventName === "collections_installation_paused");
    expect(paused?.properties).toMatchObject({ trigger: "gamemode-changed", pause_count: 1 });
    expect(typeof attrs(h).installStartedAt).toBe("number");
  });

  test("cancel emits cancelled and clears the markers", async ({ makeCollection }) => {
    const h = makeCollection(downloadOverride());
    const events = capture(h);

    await h.installRevision(makeRevision(1, [{ tag: "a" }], { collectionId: COLLECTION }));
    h.driver.cancel();

    expect(names(events)).toContain("collections_installation_cancelled");
    expect(attrs(h).installStartedAt).toBeUndefined();
  });

  test("completing the install emits completed with counts + total duration, then clears markers", async ({
    makeCollection,
  }) => {
    const h = makeCollection(downloadOverride());
    const events = capture(h);

    await h.installRevision(
      makeRevision(1, [{ tag: "a" }, { tag: "b" }], { collectionId: COLLECTION }),
    );
    // seed the session counters (maintained by InstallManager in prod)
    h.setState((draft) => {
      const session = draft.session.collections.activeSession;
      if (session != null) {
        session.installedCount = 2;
      }
    });
    await h.completeActiveInstall();

    const completed = events.find((e) => e.eventName === "collections_installation_completed");
    expect(completed).toBeDefined();
    expect(completed?.properties).toMatchObject({ required_total: 2, installed: 2, mod_count: 2 });
    expect(typeof completed?.properties.total_duration_ms).toBe("number");
    expect(attrs(h).installStartedAt).toBeUndefined();
  });

  test("a failed required member yields the failed outcome (member_install, no error_code)", async ({
    makeCollection,
  }) => {
    const h = makeCollection(downloadOverride());
    const events = capture(h);

    await h.installRevision(makeRevision(1, [{ tag: "a" }], { collectionId: COLLECTION }));
    // the single required member ends failed (terminal), so the install reaches review then closes
    h.setState((draft) => {
      const session = draft.session.collections.activeSession;
      if (session != null) {
        for (const id of Object.keys(session.mods)) {
          session.mods[id].status = "failed";
        }
        session.failedCount = 1;
      }
    });
    h.emit("did-install-dependencies", GAME, COLLECTION, false);
    await waitForDriverStep(h.driver, "review");
    await h.driver.continue();

    const failed = events.find((e) => e.eventName === "collections_installation_failed");
    expect(failed?.properties).toMatchObject({ failure_stage: "member_install", failed: 1 });
    expect(failed?.properties.error_code).toBeUndefined();
  });

  test("started reconciles with the terminal events (paused/resumed are separate)", async ({
    makeCollection,
  }) => {
    const h = makeCollection(downloadOverride());
    const events = capture(h);
    const rev = makeRevision(1, [{ tag: "a" }], { collectionId: COLLECTION });

    await h.installRevision(rev);
    h.driver.pause("user");
    await restart(h);
    h.driver.cancel();

    const counts = names(events).reduce<Record<string, number>>((acc, name) => {
      acc[name] = (acc[name] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts["collections_installation_started"]).toBe(1);
    expect(counts["collections_installation_resumed"]).toBe(1);
    expect(counts["collections_installation_paused"]).toBe(1);
    expect(counts["collections_installation_cancelled"]).toBe(1);
  });
});
