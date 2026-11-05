/**
 * Tests for the Games page tracking factory: each method emits an
 * `analytics-track-mixpanel-event` with its event name and property bag, and optional
 * props left undefined are dropped rather than sent as null.
 */
import { EventEmitter } from "events";

import { GameId } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import type { MixpanelEvent } from "@/extensions/analytics/mixpanel/MixpanelEvents";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { createGamesPageTracker } from "./gamesPageTracker";

function harness() {
  const emitter = new EventEmitter();
  const events: MixpanelEvent[] = [];
  emitter.on("analytics-track-mixpanel-event", (e: MixpanelEvent) => events.push(e));
  const tracker = createGamesPageTracker({ events: emitter } as unknown as IExtensionApi);
  return { tracker, events };
}

describe("createGamesPageTracker", () => {
  it("emits app_games_scan_completed with the scan's counts", () => {
    const { tracker, events } = harness();
    tracker.trackScanCompleted({
      trigger: "refresh",
      outcome: "success",
      duration_ms: 1200,
      detected_count: 4,
      new_detected_count: 1,
    });
    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe("app_games_scan_completed");
    expect(events[0].properties).toEqual({
      trigger: "refresh",
      outcome: "success",
      duration_ms: 1200,
      detected_count: 4,
      new_detected_count: 1,
    });
  });

  it("leaves the counts off a scan that didn't finish", () => {
    const { tracker, events } = harness();
    tracker.trackScanCompleted({
      trigger: "retry",
      outcome: "cancelled",
      duration_ms: 300,
      detected_count: undefined,
    });
    expect(events[0].properties).toEqual({
      trigger: "retry",
      outcome: "cancelled",
      duration_ms: 300,
    });
  });

  it("emits app_games_sort_changed with the section and the order picked", () => {
    const { tracker, events } = harness();
    tracker.trackSortChanged({ section: "supported", sort: "popular" });
    expect(events[0].eventName).toBe("app_games_sort_changed");
    expect(events[0].properties).toEqual({ section: "supported", sort: "popular" });
  });

  it("emits app_game_tile_action_clicked with the tile's game and store", () => {
    const { tracker, events } = harness();
    tracker.trackTileAction({
      section: "detected",
      layout: "list",
      placement: "primary",
      action: "add_game",
      game_id: GameId(1704),
      game_store: "steam",
    });
    expect(events[0].eventName).toBe("app_game_tile_action_clicked");
    expect(events[0].properties).toEqual({
      section: "detected",
      layout: "list",
      placement: "primary",
      action: "add_game",
      game_id: 1704,
      game_store: "steam",
    });
  });
});
