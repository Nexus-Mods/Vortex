/**
 * Tests for the extension-install analytics: extension_installed carries the picked IExtension
 * identity, collapses extension_type to game vs other, and surfaces the analytics-only source /
 * game / is_update fields.
 */
import { EventEmitter } from "events";

import { describe, expect, it } from "vitest";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { emitExtensionInstalled } from "./extensionInstallAnalytics";
import type { MixpanelEvent } from "./MixpanelEvents";

function harness() {
  const emitter = new EventEmitter();
  const events: MixpanelEvent[] = [];
  emitter.on("analytics-track-mixpanel-event", (e: MixpanelEvent) => events.push(e));
  return { api: { events: emitter } as unknown as IExtensionApi, events };
}

describe("extension install analytics", () => {
  it("emits extension_installed as a game extension with the manifest game", () => {
    const h = harness();
    emitExtensionInstalled(
      h.api,
      {
        id: "game-skyrimse",
        name: "Skyrim SE Support",
        author: "Nexus",
        version: "1.2.3",
        type: "game",
        modId: 42,
      },
      {
        source: "nexusmods",
        isUpdate: false,
        gameDomain: "skyrimspecialedition",
        gameName: "Skyrim Special Edition",
      },
    );
    expect(h.events).toHaveLength(1);
    expect(h.events[0].eventName).toBe("extension_installed");
    expect(h.events[0].properties).toMatchObject({
      extension_id: "game-skyrimse",
      extension_name: "Skyrim SE Support",
      author: "Nexus",
      version: "1.2.3",
      mod_id: 42,
      extension_type: "game",
      game_domain: "skyrimspecialedition",
      game_name: "Skyrim Special Edition",
      source: "nexusmods",
      is_update: false,
    });
  });

  it("classifies non-game extensions as other and omits game fields", () => {
    const h = harness();
    emitExtensionInstalled(
      h.api,
      { id: "dark-theme", name: "Dark Theme", author: "Someone", version: "0.1.0", type: "theme" },
      { source: "manual", isUpdate: true },
    );
    expect(h.events[0].properties).toMatchObject({
      extension_type: "other",
      source: "manual",
      is_update: true,
    });
    expect(h.events[0].properties.game_domain).toBeUndefined();
    expect(h.events[0].properties.game_name).toBeUndefined();
  });
});
