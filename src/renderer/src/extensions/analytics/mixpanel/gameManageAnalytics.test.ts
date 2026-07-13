/**
 * Tests for the game manage/unmanage analytics: app_game_manage carries the numeric game id and
 * the support extension version; app_game_unmanage carries the game id.
 */
import { EventEmitter } from "events";

import { describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { emitGameManaged, emitGameUnmanaged } from "./gameManageAnalytics";
import type { MixpanelEvent } from "./MixpanelEvents";

vi.mock("../../gamemode_management/util/getGame", () => ({
  getGame: (id: string) => ({ id, name: id, version: "2.3.4" }),
}));
vi.mock("../../nexus_integration/util", () => ({
  nexusGames: () => [{ domain_name: "skyrimspecialedition", id: 1704 }],
}));
vi.mock("../../nexus_integration/util/convertGameId", () => ({
  nexusGameId: () => "skyrimspecialedition",
}));

function harness() {
  const emitter = new EventEmitter();
  const events: MixpanelEvent[] = [];
  emitter.on("analytics-track-mixpanel-event", (e: MixpanelEvent) => events.push(e));
  return { api: { events: emitter } as unknown as IExtensionApi, events };
}

describe("game manage analytics", () => {
  it("emits app_game_manage with the numeric game_id and extension version", () => {
    const h = harness();
    emitGameManaged(h.api, "skyrimse");
    expect(h.events).toHaveLength(1);
    expect(h.events[0].eventName).toBe("app_game_manage");
    expect(h.events[0].properties).toMatchObject({ game_id: 1704, extension_version: "2.3.4" });
  });

  it("emits app_game_unmanage with the game_id", () => {
    const h = harness();
    emitGameUnmanaged(h.api, "skyrimse");
    expect(h.events).toHaveLength(1);
    expect(h.events[0].eventName).toBe("app_game_unmanage");
    expect(h.events[0].properties).toMatchObject({ game_id: 1704 });
  });
});
