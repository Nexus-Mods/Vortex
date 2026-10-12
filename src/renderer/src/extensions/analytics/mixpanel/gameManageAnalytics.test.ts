/**
 * Tests for the game manage/unmanage analytics: app_game_manage carries the support extension
 * version, game store, discovery method and the Games page list the game was picked from, and
 * app_game_unmanage fires with a game_id. Numeric game-id resolution is covered by
 * numericGameId.test.ts, so it stays unresolved (null) here.
 */
import { EventEmitter } from "events";

import { describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { emitGameManaged, emitGameUnmanaged } from "./gameManageAnalytics";
import type { MixpanelEvent } from "./MixpanelEvents";

vi.mock("../../gamemode_management/util/getGame", () => ({
  getGame: (id: string) => ({ id, name: id, version: "2.3.4" }),
}));

function harness(
  discovered: Record<string, { store?: string; pathSetManually?: boolean }> = {},
  addOrigin?: { gameId: string; source: "detected_list" | "all_games" },
) {
  const emitter = new EventEmitter();
  const events: MixpanelEvent[] = [];
  emitter.on("analytics-track-mixpanel-event", (e: MixpanelEvent) => events.push(e));
  const state = {
    settings: { gameMode: { discovered } },
    session: { gameMode: { gameAddOrigin: addOrigin ?? null } },
  };
  const api = { events: emitter, getState: () => state } as unknown as IExtensionApi;
  return { api, events };
}

describe("game manage analytics", () => {
  it("emits app_game_manage with the support extension version", () => {
    const h = harness();
    emitGameManaged(h.api, "skyrimse");
    expect(h.events).toHaveLength(1);
    expect(h.events[0].eventName).toBe("app_game_manage");
    expect(h.events[0].properties.extension_version).toBe("2.3.4");
    expect(h.events[0].properties).toHaveProperty("game_id");
  });

  it("includes the store the game was discovered in", () => {
    const h = harness({ skyrimse: { store: "steam" } });
    emitGameManaged(h.api, "skyrimse");
    expect(h.events[0].properties.game_store).toBe("steam");
  });

  it("sends a null game_store when the store is unknown", () => {
    const h = harness({ skyrimse: {} });
    emitGameManaged(h.api, "skyrimse");
    expect(h.events[0].properties.game_store).toBeNull();
  });

  it("reports a game whose folder was set by hand as manual", () => {
    const h = harness({ skyrimse: { store: "steam", pathSetManually: true } });
    emitGameManaged(h.api, "skyrimse");
    expect(h.events[0].properties.discovery_method).toBe("manual");
  });

  it("reports a game Vortex found itself as automatic", () => {
    const h = harness({ skyrimse: { store: "steam" } });
    emitGameManaged(h.api, "skyrimse");
    expect(h.events[0].properties.discovery_method).toBe("automatic");
  });

  it("sends null game_source when no origin was recorded", () => {
    const h = harness();
    emitGameManaged(h.api, "skyrimse");
    expect(h.events[0].properties.game_source).toBeNull();
  });

  it("records which list the game was picked from", () => {
    const h = harness({}, { gameId: "skyrimse", source: "detected_list" });
    emitGameManaged(h.api, "skyrimse");
    expect(h.events[0].properties.game_source).toBe("detected_list");
  });

  it("ignores an origin recorded for a different game", () => {
    const h = harness({}, { gameId: "fallout4", source: "all_games" });
    emitGameManaged(h.api, "skyrimse");
    expect(h.events[0].properties.game_source).toBeNull();
  });

  it("emits app_game_unmanage with a game_id", () => {
    const h = harness();
    emitGameUnmanaged(h.api, "skyrimse");
    expect(h.events).toHaveLength(1);
    expect(h.events[0].eventName).toBe("app_game_unmanage");
    expect(h.events[0].properties).toHaveProperty("game_id");
  });
});
