/**
 * Tests for the game launch/exit analytics: app_game_launched carries the launch method and a
 * session id, and app_game_exited pairs with it (same launch_session_id) with an elapsed duration.
 */
import { describe, expect, it } from "vitest";

import type {
  GameLaunchMethod,
  MixpanelEvent,
} from "../extensions/analytics/mixpanel/MixpanelEvents";
import { makeExeId } from "../reducers/session";
import { makeApiHarness, makeStarterInfo } from "../test-utils/builders";
import {
  emitExitsForStoppedTools,
  emitGameLaunched,
  recordLaunchExit,
} from "./gameLaunchAnalytics";
import type { IStarterInfo } from "./StarterInfo";

function harness() {
  const base = makeApiHarness();
  const events: MixpanelEvent[] = [];
  base.api.events.on("analytics-track-mixpanel-event", (e: MixpanelEvent) => events.push(e));
  return { api: base.api, events };
}

const launchMethodCases: Array<[Partial<IStarterInfo>, GameLaunchMethod]> = [
  [{ isGame: true, store: "steam" }, "store"],
  [{ isGame: true, store: "" }, "direct_exe"],
  [{ isGame: false, defaultPrimary: true }, "script_extender"],
  [{ isGame: false, defaultPrimary: false }, "tool"],
];

describe("game launch analytics", () => {
  it("emits app_game_launched with a session id and enabled mod count", () => {
    const h = harness();
    emitGameLaunched(h.api, makeStarterInfo({ exePath: "C:/g/launched.exe" }));
    const launched = h.events.find((e) => e.eventName === "app_game_launched");
    expect(launched).toBeDefined();
    expect(typeof launched?.properties.launch_session_id).toBe("string");
    expect(typeof launched?.properties.enabled_mod_count).toBe("number");
  });

  for (const [overrides, expected] of launchMethodCases) {
    it(`classifies launch_method as ${expected}`, () => {
      const h = harness();
      emitGameLaunched(h.api, makeStarterInfo({ ...overrides, exePath: `C:/g/${expected}.exe` }));
      const launched = h.events.find((e) => e.eventName === "app_game_launched");
      expect(launched?.properties.launch_method).toBe(expected);
    });
  }

  it("pairs app_game_exited with the launch via launch_session_id and a duration", () => {
    const h = harness();
    const info = makeStarterInfo({ exePath: "C:/g/exited.exe" });
    emitGameLaunched(h.api, info);
    const sessionId = h.events.find((e) => e.eventName === "app_game_launched")?.properties
      .launch_session_id;

    emitExitsForStoppedTools(h.api, { [makeExeId(info.exePath)]: { started: 0 } }, {});

    const exited = h.events.find((e) => e.eventName === "app_game_exited");
    expect(exited).toBeDefined();
    expect(exited?.properties.launch_session_id).toBe(sessionId);
    expect(exited?.properties.launch_method).toBe("direct_exe");
    expect(typeof exited?.properties.duration_ms).toBe("number");
    expect(exited?.properties.exit_code).toBeNull();
  });

  it("reports the exit code recorded from runExecutable on app_game_exited", () => {
    const h = harness();
    const info = makeStarterInfo({ exePath: "C:/g/coded.exe" });
    emitGameLaunched(h.api, info);
    recordLaunchExit(info.exePath, 0);

    emitExitsForStoppedTools(h.api, { [makeExeId(info.exePath)]: { started: 0 } }, {});

    const exited = h.events.find((e) => e.eventName === "app_game_exited");
    expect(exited?.properties.exit_code).toBe(0);
  });

  it("does not emit app_game_exited for an exe that was not a tracked launch", () => {
    const h = harness();
    emitExitsForStoppedTools(h.api, { "unrelated.exe": { started: 0 } }, {});
    expect(h.events.some((e) => e.eventName === "app_game_exited")).toBe(false);
  });
});
