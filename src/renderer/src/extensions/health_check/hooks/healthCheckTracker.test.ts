/**
 * Tests for the Health Check tracking factory: each callback emits a
 * `analytics-track-mixpanel-event` carrying the right event name and property bag,
 * and undefined optional props are stripped (HealthCheckEvent's contract).
 */
import { EventEmitter } from "events";

import { describe, expect, it } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";

import type { MixpanelEvent } from "../../analytics/mixpanel/MixpanelEvents";
import { createHealthCheckTracker } from "./healthCheckTracker";

function harness() {
  const emitter = new EventEmitter();
  const events: MixpanelEvent[] = [];
  emitter.on("analytics-track-mixpanel-event", (e: MixpanelEvent) => events.push(e));
  const tracker = createHealthCheckTracker({ events: emitter } as unknown as IExtensionApi);
  return { tracker, events };
}

describe("createHealthCheckTracker", () => {
  it("emits page_viewed with its properties", () => {
    const { tracker, events } = harness();
    tracker.trackPageViewed({
      active_issue_count: 3,
      hidden_issue_count: 1,
      warning_count: 2,
      suggestion_count: 1,
    });
    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe("health_check_page_viewed");
    expect(events[0].properties).toEqual({
      active_issue_count: 3,
      hidden_issue_count: 1,
      warning_count: 2,
      suggestion_count: 1,
    });
  });

  it("emits the bulk hide and unhide pair, so a restore isn't invisible", () => {
    const { tracker, events } = harness();
    tracker.trackHideAllClicked({ issue_count_hidden: 10 });
    tracker.trackUnhideAllClicked({ issue_count_unhidden: 10 });
    expect(events.map((e) => e.eventName)).toEqual([
      "health_check_hide_all_clicked",
      "health_check_unhide_all_clicked",
    ]);
    expect(events[1].properties).toEqual({ issue_count_unhidden: 10 });
  });

  it("keeps feedback_reasons on not_helpful, and leaves resolution_type off dismissed", () => {
    const { tracker, events } = harness();
    const issue = { issue_id: "a-b", check_id: "file_requirements" } as const;

    tracker.trackFeedbackNotHelpful({
      ...issue,
      issue_type: "warning",
      resolution_type: "install",
      feedback_reasons: ["wrong_mod", "already_installed"],
    });
    tracker.trackFeedbackDismissed({ ...issue, issue_type: "warning" });

    expect(events[0].properties.feedback_reasons).toEqual(["wrong_mod", "already_installed"]);
    expect(events[1].eventName).toBe("health_check_feedback_dismissed");
    expect(events[1].properties).not.toHaveProperty("resolution_type");
  });

  it("emits a no-property event (passed_viewed) with an empty bag", () => {
    const { tracker, events } = harness();
    tracker.trackPassedViewed();
    expect(events[0].eventName).toBe("health_check_passed_viewed");
    expect(events[0].properties).toEqual({});
  });

  it("uses the underscore one_click name", () => {
    const { tracker, events } = harness();
    tracker.trackOneClickInstallClicked({
      issue_id: "a-b",
      check_id: "file_requirements",
      mod_id: 42,
      mod_name: "SkyUI",
      mod_version: "5.2",
      is_adult_content: false,
    });
    expect(events[0].eventName).toBe("health_check_one_click_install_clicked");
  });

  it("carries check_id so the two checks stay separable on shared event names", () => {
    const { tracker, events } = harness();
    tracker.trackOneClickInstallClicked({
      issue_id: "a-b",
      check_id: "mod_requirements",
      mod_id: 42,
      mod_name: "SkyUI",
      mod_version: "5.2",
      is_adult_content: false,
    });
    tracker.trackBackClicked({
      issue_id: "a-b",
      check_id: "file_requirements",
      time_spent_on_detail_ms: 900,
    });
    expect(events.map((e) => e.properties.check_id as string)).toEqual([
      "mod_requirements",
      "file_requirements",
    ]);
  });

  it("omits check_id on a cross-check premium surface", () => {
    const { tracker, events } = harness();
    tracker.trackPremiumBannerShown({ placement: "list", total_issues: 3 });
    expect(events[0].properties).not.toHaveProperty("check_id");
  });

  it("emits the scan lifecycle pair", () => {
    const { tracker, events } = harness();
    tracker.trackScanTriggered({ is_manual: true, previous_issue_count: 4 });
    tracker.trackScanCompleted({
      duration_ms: 1200,
      total_issues_found: 2,
      warning_count: 1,
      suggestion_count: 1,
      health_check_passed: false,
    });
    expect(events.map((e) => e.eventName)).toEqual([
      "health_check_scan_triggered",
      "health_check_scan_completed",
    ]);
    expect(events[0].properties).toEqual({ is_manual: true, previous_issue_count: 4 });
  });

  it("omits issue_id from install events when the install isn't tied to one issue", () => {
    const { tracker, events } = harness();
    tracker.trackInstallStarted({ mod_id: 42, mod_name: "SkyUI", mod_version: "5.2" });
    expect(events[0].eventName).toBe("health_check_install_started");
    expect(events[0].properties).not.toHaveProperty("issue_id");
  });

  it("carries the requirement state, and option_count only for an OR pick", () => {
    const { tracker, events } = harness();
    const issue = { issue_id: "a-b", check_id: "file_requirements" } as const;

    tracker.trackInstallDownloadedClicked({
      ...issue,
      mod_id: 42,
      requirement_state: "downloaded_wrong_enabled",
    });
    tracker.trackInstallDownloadedClicked({
      ...issue,
      mod_id: 42,
      requirement_state: "downloaded",
      option_count: 2,
    });

    expect(events[0].eventName).toBe("health_check_install_downloaded_clicked");
    expect(events[0].properties.requirement_state).toBe("downloaded_wrong_enabled");
    expect(events[0].properties).not.toHaveProperty("option_count");
    expect(events[1].properties.option_count).toBe(2);
  });

  it("names the pick flow after opening the options, not resolving them", () => {
    const { tracker, events } = harness();
    tracker.trackViewPickOptionsClicked({ issue_id: "a-b", check_id: "file_requirements" });
    expect(events[0].eventName).toBe("health_check_view_pick_options_clicked");
    expect(events[0].properties).toEqual({ issue_id: "a-b", check_id: "file_requirements" });
  });

  it("keeps the on-disk bulk install separate from the premium-gated group install", () => {
    const { tracker, events } = harness();
    const issue = { issue_id: "a-b", check_id: "file_requirements" } as const;

    tracker.trackInstallAllDownloadedClicked({ ...issue, mod_count: 3 });
    tracker.trackInstallAllInGroupClicked({ ...issue, mod_count: 3, requirement_state: "missing" });

    expect(events.map((e) => e.eventName)).toEqual([
      "health_check_install_all_downloaded_clicked",
      "health_check_install_all_in_group_clicked",
    ]);
    expect(events[0].properties).not.toHaveProperty("requirement_state");
  });

  it("strips undefined optional properties", () => {
    const { tracker, events } = harness();
    tracker.trackPremiumModalShown({ trigger: "single_install" });
    expect(events[0].eventName).toBe("health_check_premium_modal_shown");
    expect(events[0].properties).toEqual({ trigger: "single_install" });
    expect(events[0].properties).not.toHaveProperty("issue_id");
  });
});
