import { NexusGameId, VortexGameId } from "@vortex/shared";
import type { GameFolderCheckInput, GameFolderCheckResult } from "@vortex/shared/ipc";
import { describe, expect, it } from "vitest";

import { MAX_PAYLOAD_BYTES, toGameFolderStatePayload } from "./payload";

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
  nexusGameId: NexusGameId(1704),
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
        { path: "mods/db.sqlite3", status: "unknown", inVortexFolder: true },
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
        unknownInVortexFolder: count(129),
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
      files_truncated: false,
      unknown_truncated: true,
      unknown_in_vortex_folder: count(129),
      unknown_by_folder: [{ folder: "SKSE", files: 130, bytes: 1300 }],
      unknown_by_folder_truncated: false,
    });
    expect(payload.files).toEqual([
      { path: "Data/Skyrim.esm", status: "modified", detected_by: "full_hash", from_backup: true },
      { path: "Data/Update.esm", status: "missing" },
      { path: "SKSE/skse64.dll", status: "unknown" },
      { path: "mods/db.sqlite3", status: "unknown", in_vortex_folder: true },
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

  describe("payload size", () => {
    const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
    const COUNTS = {
      steamFiles: {
        verified: count(0),
        sizeMatched: count(0),
        modified: count(0),
        missing: count(0),
        unreadable: count(0),
        notCompared: count(0),
        unchecked: count(0),
      },
      modifiedBy: { size: 0, sampled_chunk: 0, full_hash: 0 },
      sampleMissed: null,
      fileSampleMissed: null,
      hashSample: { files: 0, capped: false },
      unknown: count(0),
      unknownInVortexFolder: count(0),
      vortex: count(0),
      vortexChangedSinceDeploy: count(0),
    };
    const checked = (
      files: Extract<GameFolderCheckResult, { status: "checked" }>["files"],
      unknownByFolder: Array<{ folder: string; files: number; bytes: number }> = [],
    ): GameFolderCheckResult => ({
      status: "checked",
      verification: { status: "checked", reason: null },
      deployedBeforeCheck: true,
      files,
      unknownTruncated: false,
      unknownByFolder,
      counts: COUNTS,
      input: INPUT,
      folderCreatedAt: null,
      manifestCreatedAt: {},
      cost: { durationMs: 1, filesWalked: 0, bytesRead: 0 },
    });
    const path = (index: number) =>
      `Data/meshes/actors/character/facegendata/facegeom/Skyrim.esm/${String(index).padStart(8, "0")}.nif`;
    const unknown = (n: number) =>
      Array.from({ length: n }, (_, index) => ({ path: path(index), status: "unknown" as const }));

    it("leaves a payload under the limit untouched", () => {
      const result = checked(unknown(10), [{ folder: "Data/meshes", files: 10, bytes: 100 }]);
      const payload = toGameFolderStatePayload(result, CONTEXT);
      expect(payload.files).toHaveLength(10);
      expect(payload).toMatchObject({
        files_truncated: false,
        unknown_truncated: false,
        unknown_by_folder_truncated: false,
      });
    });

    it("trims a dirty folder's unknown files to fit, keeping a sorted random sample", () => {
      const payload = toGameFolderStatePayload(checked(unknown(2000)), CONTEXT);
      expect(bytes(payload)).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES);
      expect(payload.files.length).toBeGreaterThan(0);
      expect(payload.files.length).toBeLessThan(2000);
      expect(payload.unknown_truncated).toBe(true);
      expect(payload.files_truncated).toBe(false);
      const paths = payload.files.map((file) => file.path);
      expect(paths).toEqual(paths.toSorted());
      // a random sample, not the alphabetical start of the list
      expect(paths.at(-1)! > path(1500)).toBe(true);
    });

    it("keeps modified and missing files and folder totals ahead of unknown files", () => {
      const steam = Array.from({ length: 100 }, (_, index) => ({
        path: `Data/${index}.bsa`,
        status: index % 2 === 0 ? ("modified" as const) : ("missing" as const),
      }));
      const folders = Array.from({ length: 50 }, (_, index) => ({
        folder: `Data/folder${index}`,
        files: index,
        bytes: index * 10,
      }));
      const payload = toGameFolderStatePayload(
        checked([...steam, ...unknown(2000)], folders),
        CONTEXT,
      );
      expect(bytes(payload)).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES);
      expect(payload.files.filter((file) => file.status !== "unknown")).toHaveLength(100);
      expect(payload.unknown_by_folder).toHaveLength(50);
      expect(payload.unknown_by_folder[0]!.files).toBe(49);
      expect(payload).toMatchObject({
        files_truncated: false,
        unknown_truncated: true,
        unknown_by_folder_truncated: false,
      });
    });

    it("cuts modified and missing files too when they alone are over the limit", () => {
      const steam = Array.from({ length: 2000 }, (_, index) => ({
        path: path(index),
        status: "modified" as const,
        detectedBy: "size" as const,
      }));
      const folders = [{ folder: "Data/meshes", files: 5, bytes: 50 }];
      const payload = toGameFolderStatePayload(
        checked([...steam, ...unknown(5)], folders),
        CONTEXT,
      );
      expect(bytes(payload)).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES);
      expect(payload.files.every((file) => file.status === "modified")).toBe(true);
      expect(payload).toMatchObject({
        files_truncated: true,
        unknown_truncated: true,
        // a small entry still fills the room the cut list left
        unknown_by_folder: folders,
        unknown_by_folder_truncated: false,
      });
    });

    it("counts bytes, not characters, for non-ASCII paths", () => {
      const files = Array.from({ length: 2000 }, (_, index) => ({
        path: `Data/テクスチャ/模型/${String(index).padStart(8, "0")}.dds`,
        status: "unknown" as const,
      }));
      const payload = toGameFolderStatePayload(checked(files), CONTEXT);
      expect(bytes(payload)).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES);
    });
  });
});
