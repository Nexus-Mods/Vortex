import { VortexGameId } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import type { IGameFolderCheckMarker } from "@/extensions/analytics/types/telemetry";

import type { IState } from "../../../types/IState";
import { setGameFolderCheckMarker, setStoreGameVersionCache } from "../actions/telemetry.action";
import telemetryReducer, { type IAnalyticsTelemetryState } from "../reducers/telemetry.reducer";
import { gameFolderCheckConfig } from "./config";
import { isVortexIdle, nextDueCheck } from "./scheduler";

const stateWith = (
  activity: Record<string, string[]>,
  toolsRunning: Record<string, unknown> = {},
): IState => ({ session: { base: { activity, toolsRunning } } }) as unknown as IState;

describe("isVortexIdle", () => {
  it("is idle with nothing going on", () => {
    expect(isVortexIdle(stateWith({}))).toBe(true);
    expect(isVortexIdle(stateWith({ mods: [] }))).toBe(true);
  });

  it("is busy while mods, dependencies or plugins are being worked on", () => {
    expect(isVortexIdle(stateWith({ mods: ["deployment"] }))).toBe(false);
    expect(isVortexIdle(stateWith({ dependencies: ["gathering"] }))).toBe(false);
    expect(isVortexIdle(stateWith({ plugins: ["sorting"] }))).toBe(false);
  });

  it("ignores activity that doesn't touch the game folder", () => {
    expect(isVortexIdle(stateWith({ downloads: ["fetching"] }))).toBe(true);
  });

  it("is busy while a tool launched from Vortex runs", () => {
    expect(isVortexIdle(stateWith({}, { "c:/game/game.exe": { pid: 1 } }))).toBe(false);
  });
});

describe("nextDueCheck", () => {
  const pending = (managedAt: number): IGameFolderCheckMarker => ({ state: "pending", managedAt });

  it("picks a pending check whose settle time has passed", () => {
    expect(nextDueCheck({ skyrimse: pending(0) }, new Set(), 30_000, 30_000)).toEqual({
      gameId: "skyrimse",
    });
  });

  it("says how long until the earliest pending check is due", () => {
    const markers = { a: pending(10_000), b: pending(5_000) };
    expect(nextDueCheck(markers, new Set(), 30_000, 20_000)).toEqual({ waitMs: 15_000 });
  });

  it("skips done and skipped games", () => {
    const markers: Record<string, IGameFolderCheckMarker> = {
      a: { state: "done", status: "checked", at: 0 },
      b: pending(0),
    };
    expect(nextDueCheck(markers, new Set([VortexGameId("b")]), 0, 1)).toBeUndefined();
  });
});

describe("gameFolderCheckConfig", () => {
  it("fills defaults and takes overrides from the flag", () => {
    expect(gameFolderCheckConfig().limits.hashConcurrency).toBe(4);
    const config = gameFolderCheckConfig({ settleMs: 0, hashConcurrency: 1 });
    expect(config.settleMs).toBe(0);
    expect(config.limits.hashConcurrency).toBe(1);
    expect(config.limits.maxDurationMs).toBe(60_000);
    expect(config.limits.maxBytes).toBe(3 * 1024 ** 3);
    expect(config.limits.hashSampleFiles).toBe(2_000);
    expect(config.limits.hashSampleExecutables).toBe(1_000);
    expect(config.limits.maxUnknownPaths).toBe(2_000);
  });
});

describe("telemetry reducer", () => {
  const reduce = telemetryReducer.reducers;

  it("adds a marker to state persisted before the check existed", () => {
    const legacy = { storeGameVersions: { a: { stableKey: null, fullKey: "k" } } };
    const next = reduce[setGameFolderCheckMarker.getType()](legacy, {
      gameId: "b",
      marker: { state: "pending", managedAt: 1 },
    });
    expect(next).toEqual({
      storeGameVersions: legacy.storeGameVersions,
      gameFolderChecks: { b: { state: "pending", managedAt: 1 } },
    });
  });

  it("keeps the markers when the version cache changes", () => {
    const state: IAnalyticsTelemetryState = {
      storeGameVersions: {},
      gameFolderChecks: { b: { state: "pending", managedAt: 1 } },
    };
    const next = reduce[setStoreGameVersionCache.getType()](state, {
      gameId: "a",
      cache: { stableKey: null, fullKey: "k" },
    });
    expect(next.gameFolderChecks).toEqual(state.gameFolderChecks);
  });
});
