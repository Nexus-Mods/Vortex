/**
 * Tests for the deploy analytics: mods_deployed carries the deployment method, file/enabled-mod
 * counts, and the manual / collection-postprocess flags. game_id resolution is covered by
 * numericGameId.test.ts; here it's unresolved (null) as in the other harness-based analytics tests.
 */
import { EventEmitter } from "events";

import { describe, expect, it } from "vitest";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { emitModsDeployed } from "./deployAnalytics";
import type { MixpanelEvent } from "./MixpanelEvents";

function harness() {
  const emitter = new EventEmitter();
  const events: MixpanelEvent[] = [];
  emitter.on("analytics-track-mixpanel-event", (e: MixpanelEvent) => events.push(e));
  return { api: { events: emitter } as unknown as IExtensionApi, events };
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
    });
    expect(h.events).toHaveLength(1);
    expect(h.events[0].eventName).toBe("mods_deployed");
    expect(h.events[0].properties).toMatchObject({
      deployment_method: "hardlink",
      file_count: 42,
      enabled_mod_count: 7,
      manual: true,
      is_collection_postprocess: false,
    });
  });
});
