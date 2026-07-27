/**
 * Tests for the Health Check tracking factory: each callback emits a
 * `analytics-track-mixpanel-event` carrying the right event name and property bag,
 * and undefined optional props are stripped (HealthCheckEvent's contract).
 */
import { EventEmitter } from "events";

import { describe, expect, it } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";

import type { MixpanelEvent } from "../../analytics/mixpanel/MixpanelEvents";
import { createHealthCheckTracker } from "./useHealthCheckTracking";

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
      mod_id: 42,
      mod_name: "SkyUI",
      mod_version: "5.2",
      is_adult_content: false,
    });
    expect(events[0].eventName).toBe("health_check_one_click_install_clicked");
  });

  it("strips undefined optional properties", () => {
    const { tracker, events } = harness();
    tracker.trackPremiumModalShown({ trigger_context: "single_install" });
    expect(events[0].eventName).toBe("health_check_premium_modal_shown");
    expect(events[0].properties).toEqual({ trigger_context: "single_install" });
    expect(events[0].properties).not.toHaveProperty("issue_id");
  });
});
