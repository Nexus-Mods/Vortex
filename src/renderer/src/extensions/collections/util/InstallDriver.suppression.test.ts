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
import Bluebird from "bluebird";
import { describe, expect } from "vitest";

import { makeCollectionModInfo, makeDownload, makeRevision } from "../../../test-utils/builders";
import { test } from "../../../test-utils/collectionTest";
import type { ICollectionHarness } from "../../../test-utils/harnessTypes";

const GAME = "skyrimse";
const COLLECTION = "col-1";
const ARCHIVE = "dl-col-1";

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

/** Stands in for the test runner: counts holds per event and records re-run requests. */
function trackSuppression(h: ICollectionHarness) {
  const held: Record<string, number> = {};
  const reruns: string[] = [];
  (h.api.ext as Record<string, unknown>).withSuppressedTests = (
    tests: string[],
    cb: () => Bluebird<void>,
  ) => {
    tests.forEach((test) => (held[test] = (held[test] ?? 0) + 1));
    return cb().finally(() => tests.forEach((test) => (held[test] -= 1)));
  };
  h.api.events.on("trigger-test-run", (event: string) => reruns.push(event));
  return { held, reruns };
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
    expect(reruns).toEqual(
      expect.arrayContaining([
        "plugins-changed",
        "mod-installed",
        "mod-activated",
        "settings-changed",
      ]),
    );
  });

  test("a cancelled install releases the hold", async ({ makeCollection }) => {
    const h = makeCollection(downloadOverride());
    const { held } = trackSuppression(h);

    await h.installRevision(makeRevision(1, [{ tag: "a" }], { collectionId: COLLECTION }));
    h.driver.cancel();
    await settle();

    expect(held["plugins-changed"]).toBe(0);
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
