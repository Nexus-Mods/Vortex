/**
 * Tests for the game launch/exit analytics: app_game_launched carries the launch method and a
 * session id, and app_game_exited pairs with it (same launch_session_id) with an elapsed duration.
 */
import { describe, expect, it, vi } from "vitest";

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
    const launched = h.events.find((e) => e.eventName === "app_game_launched");
    const sessionId = launched?.properties.launch_session_id;

    emitExitsForStoppedTools(h.api, { [makeExeId(info.exePath)]: { started: 0 } }, {});

    const exited = h.events.find((e) => e.eventName === "app_game_exited");
    expect(exited).toBeDefined();
    expect(exited?.properties.launch_session_id).toBe(sessionId);
    expect(exited?.properties.launch_method).toBe("direct_exe");
    expect(exited?.properties.enabled_mod_count).toBe(launched?.properties.enabled_mod_count);
    expect(typeof exited?.properties.duration_ms).toBe("number");
    expect(exited?.properties.duration_reliable).toBe(true);
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

describe("exit detection for launches that hand off to the game", () => {
  // A harness whose active game (skyrimse) has a discovered executable, so the launch code can
  // resolve the real game process to watch.
  function gameHarness() {
    const h = harness();
    const state = h.api.getState() as unknown as {
      settings: { gameMode: { discovered: Record<string, unknown> } };
    };
    state.settings.gameMode.discovered.skyrimse = {
      executable: "SkyrimSE.exe",
      path: "C:/games/skyrimse",
    };
    return h;
  }

  const running = (...exeIds: string[]): Record<string, unknown> =>
    Object.fromEntries(exeIds.map((id) => [id, { pid: 1, started: 0, exclusive: false }]));

  const gameExeId = makeExeId("SkyrimSE.exe");

  it("ties a script-extender launch's exit to the game process, not the loader", () => {
    const h = gameHarness();
    const info = makeStarterInfo({
      isGame: false,
      defaultPrimary: true,
      id: "skse64",
      exePath: "C:/games/skyrimse/skse64_loader.exe",
    });
    emitGameLaunched(h.api, info);
    const sessionId = h.events.find((e) => e.eventName === "app_game_launched")?.properties
      .launch_session_id;
    const loaderId = makeExeId(info.exePath);

    // the loader exits during the handoff - must NOT end the session
    emitExitsForStoppedTools(h.api, running(loaderId), running());
    expect(h.events.some((e) => e.eventName === "app_game_exited")).toBe(false);

    // the game process comes up; still running, no exit yet
    emitExitsForStoppedTools(h.api, running(), running(gameExeId));
    expect(h.events.some((e) => e.eventName === "app_game_exited")).toBe(false);

    // the game process stops - now the session ends, once, paired with the launch
    emitExitsForStoppedTools(h.api, running(gameExeId), running());
    const exited = h.events.filter((e) => e.eventName === "app_game_exited");
    expect(exited).toHaveLength(1);
    expect(exited[0].properties.launch_session_id).toBe(sessionId);
    expect(typeof exited[0].properties.duration_ms).toBe("number");
    // the game was seen running and then stopped, so this duration is trusted
    expect(exited[0].properties.duration_reliable).toBe(true);
  });

  it("keeps watching its own process for a plain utility tool", () => {
    const h = gameHarness();
    const info = makeStarterInfo({
      isGame: false,
      defaultPrimary: false,
      id: "nifskope",
      exePath: "C:/tools/nifskope.exe",
    });
    emitGameLaunched(h.api, info);

    // the game process appearing/stopping is irrelevant to a utility tool
    emitExitsForStoppedTools(h.api, running(gameExeId), running());
    expect(h.events.some((e) => e.eventName === "app_game_exited")).toBe(false);

    // the tool's own process stopping ends its session
    emitExitsForStoppedTools(h.api, running(makeExeId(info.exePath)), running());
    expect(h.events.filter((e) => e.eventName === "app_game_exited")).toHaveLength(1);
  });

  it("emits a best-effort exit with the loader's exit code if the game never appears", () => {
    vi.useFakeTimers();
    try {
      const h = gameHarness();
      const info = makeStarterInfo({
        isGame: false,
        defaultPrimary: true,
        id: "f4se",
        exePath: "C:/games/fallout4/f4se_loader.exe",
      });
      emitGameLaunched(h.api, info);
      recordLaunchExit(info.exePath, 1);

      expect(h.events.some((e) => e.eventName === "app_game_exited")).toBe(false);
      vi.advanceTimersByTime(5 * 60 * 1000);

      const exited = h.events.filter((e) => e.eventName === "app_game_exited");
      expect(exited).toHaveLength(1);
      expect(exited[0].properties.exit_code).toBe(1);
      // the game process never appeared, so this is a best-effort exit with an untrusted duration
      expect(exited[0].properties.duration_reliable).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
