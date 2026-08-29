import { EventEmitter } from "node:events";

import type { UpdaterState } from "@vortex/shared/ipc";
import { describe, expect, it } from "vitest";

import type { IExtensionApi } from "../../types/IExtensionContext";
import type { MixpanelEvent } from "../analytics/mixpanel/MixpanelEvents";
import { createUpdaterAnalytics, isTransition } from "./updaterAnalytics";

function harness(channel = "stable") {
  const emitter = new EventEmitter();
  const events: MixpanelEvent[] = [];
  emitter.on("analytics-track-mixpanel-event", (e: MixpanelEvent) => events.push(e));
  let clock = 1000;
  const analytics = createUpdaterAnalytics({
    api: { events: emitter } as unknown as IExtensionApi,
    currentVersion: () => "2.6.0",
    channel: () => channel,
    now: () => clock,
  });
  return { analytics, events, tick: (ms: number) => (clock += ms) };
}

const names = (events: MixpanelEvent[]) => events.map((e) => e.eventName);

const checkingManual: UpdaterState = { type: "checking", manual: true };
const checkingBackground: UpdaterState = { type: "checking", manual: false };
const available: UpdaterState = { type: "available", version: "2.7.0" };
const downloading: UpdaterState = {
  type: "downloading",
  version: "2.7.0",
  kind: "update",
  manual: true,
};
const staged: UpdaterState = { type: "staged", version: "2.7.0", kind: "update" };

describe("updater analytics: the funnel", () => {
  it("offered -> download_started -> download_completed with duration", () => {
    const { analytics, events, tick } = harness();

    analytics.onTransition(null, { type: "idle" });
    analytics.onTransition({ type: "idle" }, checkingManual);
    analytics.onTransition(checkingManual, available);
    analytics.onTransition(available, downloading);
    tick(18_000);
    analytics.onTransition(downloading, staged);

    expect(names(events)).toEqual([
      "app_update_check_completed",
      "app_update_offered",
      "app_update_download_started",
      "app_update_download_completed",
    ]);
    expect(events[0]!.properties).toMatchObject({ manual: true, outcome: "offered" });
    expect(events[1]!.properties).toMatchObject({
      from_version: "2.6.0",
      to_version: "2.7.0",
      kind: "update",
      manual: true,
      update_channel: "stable",
    });
    expect(events[3]!.properties).toMatchObject({ duration_ms: 18_000, kind: "update" });
    for (const event of events) {
      expect(event.properties.update_channel).toBe("stable");
    }
  });

  it("an automatic patch download is offered and started in one transition", () => {
    const { analytics, events } = harness();
    const patch: UpdaterState = {
      type: "downloading",
      version: "2.6.1",
      kind: "patch",
      manual: false,
    };

    analytics.onTransition(checkingBackground, patch);

    expect(names(events)).toEqual([
      "app_update_check_completed",
      "app_update_offered",
      "app_update_download_started",
    ]);
    expect(events[1]!.properties).toMatchObject({ kind: "patch", manual: false });
  });

  it("a failed download reports the error and whether a retry was offered", () => {
    const { analytics, events } = harness();
    analytics.onTransition(available, downloading);
    analytics.onTransition(downloading, {
      type: "error",
      message: "feed died",
      manual: true,
      retry: { version: "2.7.0" },
    });

    const failed = events.find((e) => e.eventName === "app_update_download_failed")!;
    expect(failed.properties).toMatchObject({
      to_version: "2.7.0",
      error_message: "feed died",
      retry_offered: true,
    });
  });

  it("a staged update restored by a check (no download watched) is not a completion", () => {
    const { analytics, events } = harness();
    analytics.onTransition(checkingBackground, staged);
    expect(events).toHaveLength(0);
  });
});

describe("updater analytics: checks", () => {
  it("reports every manual outcome, including up to date and failed", () => {
    const { analytics, events } = harness();
    analytics.onTransition(checkingManual, { type: "idle" });
    analytics.onTransition(checkingManual, { type: "error", message: "offline", manual: true });

    expect(names(events)).toEqual(["app_update_check_completed", "app_update_check_completed"]);
    expect(events[0]!.properties).toMatchObject({ manual: true, outcome: "up_to_date" });
    expect(events[1]!.properties).toMatchObject({
      manual: true,
      outcome: "failed",
      error_message: "offline",
    });
  });

  it("stays silent for a background check that finds nothing", () => {
    const { analytics, events } = harness();
    analytics.onTransition(checkingBackground, { type: "idle" });
    expect(events).toHaveLength(0);
  });

  // landing back on an update the user already has is not an offer: counting it as one would
  // inflate the offer rate by 6 a day for anyone who leaves an update staged
  it("reports a manual check that lands on an already-staged update as such", () => {
    const { analytics, events } = harness();
    analytics.onTransition(checkingManual, staged);
    expect(names(events)).toEqual(["app_update_check_completed"]);
    expect(events[0]!.properties).toMatchObject({ manual: true, outcome: "already_staged" });
  });

  it("truncates long error messages on both failure events", () => {
    const { analytics, events } = harness();
    const long = "x".repeat(500);
    analytics.onTransition(checkingManual, { type: "error", message: long, manual: true });
    analytics.onTransition(downloading, { type: "error", message: long, manual: true });

    expect(names(events)).toEqual(["app_update_check_completed", "app_update_download_failed"]);
    expect(events[0]!.properties["error_message"]).toHaveLength(200);
    expect(events[1]!.properties["error_message"]).toHaveLength(200);
  });

  it("reports a background check that fails or offers", () => {
    const { analytics, events } = harness();
    analytics.onTransition(checkingBackground, { type: "error", message: "429", manual: false });
    analytics.onTransition(checkingBackground, available);
    expect(names(events)).toEqual([
      "app_update_check_completed",
      "app_update_check_completed",
      "app_update_offered",
    ]);
    expect(events[0]!.properties).toMatchObject({ manual: false, outcome: "failed" });
  });
});

describe("updater analytics: decisions", () => {
  it("emits install_started only for a staged state, with its source", () => {
    const { analytics, events } = harness();
    analytics.installStarted(available, "notification");
    analytics.installStarted(staged, "dialog");
    expect(names(events)).toEqual(["app_update_install_started"]);
    expect(events[0]!.properties).toMatchObject({
      to_version: "2.7.0",
      kind: "update",
      source: "dialog",
    });
  });

  it("emits downgrade_decided, channel_changed, release_notes_viewed and app_updated", () => {
    const { analytics, events } = harness("beta");
    analytics.downgradeDecided("2.5.0", false);
    analytics.channelChanged("beta", "stable");
    analytics.releaseNotesViewed("2.7.0", "offer");
    analytics.appUpdated("2.5.9");

    expect(names(events)).toEqual([
      "app_update_downgrade_decided",
      "app_update_channel_changed",
      "app_update_release_notes_viewed",
      "app_updated",
    ]);
    expect(events[0]!.properties).toMatchObject({
      from_version: "2.6.0",
      to_version: "2.5.0",
      accepted: false,
      update_channel: "beta",
    });
    // the channel event carries the channel being switched to
    expect(events[1]!.properties).toMatchObject({
      from_channel: "beta",
      to_channel: "stable",
      update_channel: "stable",
    });
    expect(events[3]!.properties).toMatchObject({ from_version: "2.5.9", to_version: "2.6.0" });
  });

  // collapsing these would lose whether notes are read before downloading or before restarting
  it("keeps the release notes sources apart", () => {
    const { analytics, events } = harness("stable");
    analytics.releaseNotesViewed("2.7.0", "offer");
    analytics.releaseNotesViewed("2.7.0", "staged");
    analytics.releaseNotesViewed("2.7.0", "error_retry");
    analytics.releaseNotesViewed("2.6.0", "post_update");

    expect(events.map((event) => event.properties["source"])).toEqual([
      "offer",
      "staged",
      "error_retry",
      "post_update",
    ]);
  });
});

describe("isTransition", () => {
  it("filters percent ticks and identical states, keeps real changes", () => {
    expect(isTransition({ ...downloading, percent: 1 }, { ...downloading, percent: 2 })).toBe(
      false,
    );
    expect(isTransition(available, available)).toBe(false);
    expect(isTransition(downloading, staged)).toBe(true);
    expect(isTransition(null, available)).toBe(true);
    expect(isTransition(downloading, { ...downloading, version: "2.8.0" })).toBe(true);
  });
});
