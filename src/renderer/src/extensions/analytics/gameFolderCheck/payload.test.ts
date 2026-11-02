import { GameId, VortexGameId } from "@vortex/shared";
import type { GameFolderCheckInput, GameFolderCheckResult } from "@vortex/shared/ipc";
import { describe, expect, it } from "vitest";

import { toGameFolderStatePayload } from "./payload";

const INPUT: GameFolderCheckInput = {
  gameId: VortexGameId("skyrimse"),
  appId: 489830,
  buildId: 16659740,
  targetBuildId: 16659740,
  steamPath: "C:\\Steam",
  gamePath: "C:\\Steam\\steamapps\\common\\Skyrim Special Edition",
  depots: [{ depotId: 489831, manifestId: "7997079406114800065" }],
  fullVerify: false,
  limits: {
    maxDurationMs: 60_000,
    maxBytes: 1024 ** 3,
    hashConcurrency: 4,
    hashSampleExecutables: 1000,
    hashSampleFiles: 1000,
    maxUnknownPaths: 1000,
  },
};

const count = (files: number, bytes = files * 10) => ({ files, bytes });

const CONTEXT = {
  nexusGameId: GameId(1704),
  managedAt: Date.UTC(2026, 9, 29),
  steamLastUpdated: null,
};

describe("toGameFolderStatePayload", () => {
  it("maps a finished check", () => {
    const result: GameFolderCheckResult = {
      status: "checked",
      verification: { status: "aborted", reason: "max_duration" },
      deployedBeforeCheck: true,
      files: [
        { path: "Data/Skyrim.esm", status: "modified", detectedBy: "full_hash", fromBackup: true },
        { path: "Data/Update.esm", status: "missing" },
        { path: "SKSE/skse64.dll", status: "unknown" },
      ],
      unknownTruncated: true,
      unknownByFolder: [{ folder: "SKSE", files: 130, bytes: 1300 }],
      counts: {
        steamFiles: {
          verified: count(40),
          sizeMatched: count(7),
          modified: count(1),
          missing: count(2),
          unreadable: count(0),
          notCompared: count(3),
          unchecked: count(4),
        },
        modifiedBy: { size: 1, sampled_chunk: 0, full_hash: 0 },
        sampleMissed: null,
        fileSampleMissed: null,
        hashSample: { files: 45, capped: true },
        unknown: count(130),
        vortex: count(5),
        vortexChangedSinceDeploy: count(1),
      },
      input: INPUT,
      folderCreatedAt: Date.UTC(2020, 0, 1),
      manifestCreatedAt: { "489831_7997079406114800065": Date.UTC(2024, 0, 1) },
      cost: { durationMs: 400, filesWalked: 182, bytesRead: 1024 },
    };
    const payload = toGameFolderStatePayload(result, CONTEXT);
    expect(payload).toMatchObject({
      game_id: "1704",
      status: "checked",
      reason: null,
      verification: { status: "aborted", reason: "max_duration" },
      deployed_before_check: true,
      steam: {
        app_id: 489830,
        depots: [
          {
            depot_id: 489831,
            manifest_id: "7997079406114800065",
            manifest_created_at: "2024-01-01T00:00:00.000Z",
          },
        ],
      },
      managed_at: "2026-10-29T00:00:00.000Z",
      folder_created_at: "2020-01-01T00:00:00.000Z",
      steam_files: { size_matched: count(7), not_compared: count(3), unchecked: count(4) },
      hashed_sample: { files: 45, capped: true },
      unknown: count(130),
      vortex_changed_since_deploy: count(1),
      cost: { duration_ms: 400, files_walked: 182, bytes_read: 1024 },
      unknown_truncated: true,
      unknown_by_folder: [{ folder: "SKSE", files: 130, bytes: 1300 }],
    });
    expect(payload.files).toEqual([
      { path: "Data/Skyrim.esm", status: "modified", detected_by: "full_hash", from_backup: true },
      { path: "Data/Update.esm", status: "missing" },
      { path: "SKSE/skse64.dll", status: "unknown" },
    ]);
  });

  it("sends zero counts and the reason when there was no baseline", () => {
    const payload = toGameFolderStatePayload(
      {
        status: "no_baseline",
        reason: "manifest_missing",
        input: INPUT,
        folderCreatedAt: null,
        manifestCreatedAt: {},
        cost: { durationMs: 1, filesWalked: 0, bytesRead: 0 },
      },
      CONTEXT,
    );
    expect(payload).toMatchObject({
      status: "no_baseline",
      reason: "manifest_missing",
      verification: null,
      unknown: count(0),
      steam: { depots: [{ manifest_created_at: null }] },
    });
  });
});
