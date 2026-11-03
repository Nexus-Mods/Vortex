/**
 * Tests for the game manage/unmanage analytics: app_game_manage carries the support extension
 * version, game store, discovery method and the Games page list the game was picked from, and
 * app_game_unmanage fires with a game_id. Both events carry support_tier, resolved from the same
 * numeric id as game_id: the id resolution is mock-fixed here and supportTier reads real state
 * (Tier 0 from the persisted tier0 map, Tier 2 from catalog coverage; the function itself is
 * covered by supportTier.test.ts).
 */
import { EventEmitter } from "events";

import { GameId } from "@vortex/shared";
import { describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { emitGameManaged, emitGameUnmanaged } from "./gameManageAnalytics";
import type { MixpanelEvent } from "./MixpanelEvents";
import { numericNexusGameId } from "./numericGameId";

vi.mock("../../gamemode_management/util/getGame", () => ({
  // the version comes from the extension's game object; a Tier 0 synthetic game has none
  getGame: (id: string) => ({ id, name: id, version: id === "skyrimse" ? "2.3.4" : undefined }),
}));
vi.mock("./numericGameId", () => ({ numericNexusGameId: vi.fn(() => null) }));

function harness(
  discovered: Record<string, { store?: string; pathSetManually?: boolean }> = {},
  addOrigin?: { gameId: string; source: "detected_list" | "all_games" },
  tierZero: Record<string, unknown> = {},
  catalogGameIds: number[] = [],
) {
  const emitter = new EventEmitter();
  const events: MixpanelEvent[] = [];
  emitter.on("analytics-track-mixpanel-event", (e: MixpanelEvent) => events.push(e));
  const state = {
    settings: { gameMode: { discovered } },
    persistent: { gameMode: { tier0: tierZero } },
    session: {
      gameMode: { gameAddOrigin: addOrigin ?? null },
      extensions: { available: catalogGameIds.map((gameId) => ({ gameId })) },
    },
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
    // the tier is only defined when the numeric game id resolves; left out otherwise
    expect(h.events[0].properties.support_tier).toBeUndefined();
  });

  it("categorizes a Tier 0 game on app_game_manage", () => {
    const h = harness({}, undefined, { 1303: { domain: "emberville" } });
    vi.mocked(numericNexusGameId).mockReturnValueOnce(GameId(1303));
    emitGameManaged(h.api, "emberville");
    expect(h.events[0].properties.support_tier).toBe("Tier 0");
    // a Tier 0 game has no support extension, so no version either
    expect(h.events[0].properties.extension_version).toBe("");
  });

  it("categorizes an extension-backed game as Tier 2 on app_game_manage", () => {
    const h = harness({}, undefined, {}, [1704]);
    vi.mocked(numericNexusGameId).mockReturnValueOnce(GameId(1704));
    emitGameManaged(h.api, "skyrimse");
    expect(h.events[0].properties.support_tier).toBe("Tier 2");
    expect(h.events[0].properties.extension_version).toBe("2.3.4");
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
    expect(h.events[0].properties.support_tier).toBeUndefined();
  });

  it("categorizes a Tier 0 game on app_game_unmanage", () => {
    const h = harness({}, undefined, { 1303: { domain: "emberville" } });
    vi.mocked(numericNexusGameId).mockReturnValueOnce(GameId(1303));
    emitGameUnmanaged(h.api, "emberville");
    expect(h.events[0].properties.support_tier).toBe("Tier 0");
  });

  it("categorizes an extension-backed game as Tier 2 on app_game_unmanage", () => {
    const h = harness({}, undefined, {}, [1704]);
    vi.mocked(numericNexusGameId).mockReturnValueOnce(GameId(1704));
    emitGameUnmanaged(h.api, "skyrimse");
    expect(h.events[0].properties.support_tier).toBe("Tier 2");
  });
});
