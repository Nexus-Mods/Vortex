/**
 * Tests for the deploy analytics: mods_deployed carries the deployment method, file/enabled-mod
 * counts, the manual / collection-postprocess flags and the duration. support_tier is resolved
 * from the same numeric id as game_id: the id resolution is mock-fixed here and supportTier
 * reads real state, so Tier 0 comes from the persisted tier0 map and Tier 2 from catalog
 * coverage (the function itself is covered by supportTier.test.ts).
 */
import { EventEmitter } from "events";

import { GameId } from "@vortex/shared";
import { describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { emitModsDeployed } from "./deployAnalytics";
import type { MixpanelEvent } from "./MixpanelEvents";
import { numericNexusGameId } from "./numericGameId";

vi.mock("./numericGameId", () => ({ numericNexusGameId: vi.fn(() => null) }));

function harness(state: Record<string, unknown> = {}) {
  const emitter = new EventEmitter();
  const events: MixpanelEvent[] = [];
  emitter.on("analytics-track-mixpanel-event", (e: MixpanelEvent) => events.push(e));
  // supportTier reads the persisted tier0 map first, so the slice always has to exist
  const fullState = { persistent: { gameMode: { tier0: {} } }, session: {}, ...state };
  return {
    api: { events: emitter, getState: () => fullState } as unknown as IExtensionApi,
    events,
  };
}

describe("deploy analytics", () => {
  it("emits mods_deployed with the deployment details", () => {
    const h = harness();
    emitModsDeployed(h.api, {
      gameId: "skyrimse",
      deploymentMethod: "hardlink",
      fileCount: 42,
      enabledModCount: 7,
      manual: true,
      isCollectionPostprocess: false,
      durationMs: 1500,
    });
    expect(h.events).toHaveLength(1);
    expect(h.events[0].eventName).toBe("mods_deployed");
    expect(h.events[0].properties).toMatchObject({
      deployment_method: "hardlink",
      file_count: 42,
      enabled_mod_count: 7,
      manual: true,
      is_collection_postprocess: false,
      duration_ms: 1500,
    });
    // the tier is only defined when the numeric game id resolves; left out otherwise
    expect(h.events[0].properties.support_tier).toBeUndefined();
  });

  it("categorizes a Tier 0 game on mods_deployed", () => {
    const h = harness({
      persistent: { gameMode: { tier0: { 1303: { domain: "emberville" } } } },
    });
    vi.mocked(numericNexusGameId).mockReturnValueOnce(GameId(1303));
    emitModsDeployed(h.api, {
      gameId: "emberville",
      deploymentMethod: "hardlink",
      fileCount: 42,
      enabledModCount: 7,
      manual: false,
      isCollectionPostprocess: false,
      durationMs: 1500,
    });
    expect(h.events[0].properties.support_tier).toBe("Tier 0");
  });

  it("categorizes an extension-backed game as Tier 2 on mods_deployed", () => {
    const h = harness({ session: { extensions: { available: [{ gameId: 1704 }] } } });
    vi.mocked(numericNexusGameId).mockReturnValueOnce(GameId(1704));
    emitModsDeployed(h.api, {
      gameId: "skyrimse",
      deploymentMethod: "hardlink",
      fileCount: 42,
      enabledModCount: 7,
      manual: false,
      isCollectionPostprocess: false,
      durationMs: 1500,
    });
    expect(h.events[0].properties.support_tier).toBe("Tier 2");
  });
});
