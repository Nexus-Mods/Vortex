import { NexusGameId, VortexGameId } from "@vortex/shared";
import type { IGameFolderCheckInput, GameFolderCheckResult } from "@vortex/shared/ipc";
import { describe, expect, it } from "vitest";

import { toBatches, toGameFolderStateEvents } from "./payload";

const INPUT: IGameFolderCheckInput = {
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
  checkId: "6f1c2e0a-4b7d-4e2a-9c1f-3d5e7a9b1c2d",
  maxFileParts: 3,
  maxEventBytes: 60 * 1024,
};

describe("toBatches", () => {
  const event = (id: number, size: number) => ({ id, payload: "x".repeat(size - 2) });
  const ids = (batches: Array<Array<{ id: number }>>) =>
    batches.map((batch) => batch.map((entry) => entry.id));

  it("keeps events that fit together in one batch", () => {
    expect(ids(toBatches([event(1, 40), event(2, 40), event(3, 20)], 100))).toEqual([[1, 2, 3]]);
  });

  it("starts a new batch when the next event would go over, keeping the order", () => {
    const events = [event(1, 60), event(2, 60), event(3, 30), event(4, 60)];
    expect(ids(toBatches(events, 100))).toEqual([[1], [2, 3], [4]]);
  });

  it("gives an event over the limit a batch to itself", () => {
    expect(ids(toBatches([event(1, 10), event(2, 500), event(3, 10)], 100))).toEqual([
      [1],
      [2],
      [3],
    ]);
  });

  it("returns no batches for no events", () => {
    expect(toBatches([], 100)).toEqual([]);
  });
});

describe("toGameFolderStateEvents", () => {
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
    const { state, fileParts } = toGameFolderStateEvents(result, CONTEXT);
    expect(state).toMatchObject({
      check_id: CONTEXT.checkId,
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
      file_parts: 1,
      max_file_parts: 3,
      files_truncated: false,
      unknown_truncated: true,
      unknown_in_vortex_folder: count(129),
      unknown_by_folder: [{ folder: "SKSE", files: 130, bytes: 1300 }],
      unknown_by_folder_truncated: false,
    });
    expect(state).not.toHaveProperty("files");
    expect(fileParts).toEqual([
      {
        check_id: CONTEXT.checkId,
        game_id: "1704",
        part: 1,
        parts: 1,
        files: [
          {
            path: "Data/Skyrim.esm",
            status: "modified",
            detected_by: "full_hash",
            from_backup: true,
          },
          { path: "Data/Update.esm", status: "missing" },
          { path: "SKSE/skse64.dll", status: "unknown" },
          { path: "mods/db.sqlite3", status: "unknown", in_vortex_folder: true },
        ],
      },
    ]);
  });

  it("sends zero counts and the reason when there was no baseline", () => {
    const { state, fileParts } = toGameFolderStateEvents(
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
    expect(state).toMatchObject({
      status: "no_baseline",
      reason: "manifest_missing",
      verification: null,
      unknown: count(0),
      steam: { depots: [{ manifest_created_at: null }] },
      file_parts: 0,
    });
    expect(fileParts).toEqual([]);
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

    const modified = (n: number) =>
      Array.from({ length: n }, (_, index) => ({
        path: path(index),
        status: "modified" as const,
        detectedBy: "size" as const,
      }));
    const events = (result: GameFolderCheckResult, maxFileParts = CONTEXT.maxFileParts) =>
      toGameFolderStateEvents(result, { ...CONTEXT, maxFileParts });
    const sentFiles = (fileParts: ReturnType<typeof events>["fileParts"]) =>
      fileParts.flatMap((part) => part.files);

    it("sends a clean folder as the state event alone", () => {
      const { state, fileParts } = events(checked([]));
      expect(fileParts).toEqual([]);
      expect(state).toMatchObject({
        file_parts: 0,
        files_truncated: false,
        unknown_truncated: false,
      });
    });

    it("keeps a short list in one file event, in the order it arrived", () => {
      const result = checked(unknown(10), [{ folder: "Data/meshes", files: 10, bytes: 100 }]);
      const { state, fileParts } = events(result);
      expect(fileParts).toHaveLength(1);
      expect(fileParts[0]).toMatchObject({ part: 1, parts: 1 });
      expect(fileParts[0]!.files.map((file) => file.path)).toEqual(
        unknown(10).map((file) => file.path),
      );
      expect(state).toMatchObject({
        file_parts: 1,
        files_truncated: false,
        unknown_truncated: false,
        unknown_by_folder_truncated: false,
      });
    });

    it("spreads a list too long for one event over several, leaving nothing out", () => {
      const { state, fileParts } = events(checked(unknown(1500)));
      expect(fileParts).toHaveLength(3);
      expect(fileParts.map(({ part, parts }) => [part, parts])).toEqual([
        [1, 3],
        [2, 3],
        [3, 3],
      ]);
      for (const part of fileParts) {
        expect(bytes(part)).toBeLessThanOrEqual(CONTEXT.maxEventBytes);
        expect(part.check_id).toBe(state.check_id);
      }
      expect(sentFiles(fileParts).map((file) => file.path)).toEqual(
        unknown(1500).map((file) => file.path),
      );
      expect(state).toMatchObject({ file_parts: 3, unknown_truncated: false });
    });

    it("sends a sorted random sample of the unknown files when not all of them fit", () => {
      const { state, fileParts } = events(checked(unknown(4000)));
      expect(fileParts).toHaveLength(3);
      for (const part of fileParts) expect(bytes(part)).toBeLessThanOrEqual(CONTEXT.maxEventBytes);
      const paths = sentFiles(fileParts).map((file) => file.path);
      expect(paths.length).toBeGreaterThan(1500);
      expect(paths.length).toBeLessThan(4000);
      expect(paths).toEqual(paths.toSorted());
      // a random sample, not the alphabetical start of the list
      expect(paths.at(-1)! > path(3000)).toBe(true);
      expect(state).toMatchObject({ files_truncated: false, unknown_truncated: true });
    });

    it("sends modified and missing files ahead of unknown files", () => {
      const steam = Array.from({ length: 100 }, (_, index) => ({
        path: `Data/${index}.bsa`,
        status: index % 2 === 0 ? ("modified" as const) : ("missing" as const),
      }));
      const { state, fileParts } = events(checked([...steam, ...unknown(4000)]));
      const sent = sentFiles(fileParts);
      expect(sent.slice(0, 100).map((file) => file.path)).toEqual(steam.map((file) => file.path));
      expect(sent.slice(100).every((file) => file.status === "unknown")).toBe(true);
      expect(state).toMatchObject({ files_truncated: false, unknown_truncated: true });
    });

    it("cuts modified and missing files too when they alone are too many", () => {
      const { state, fileParts } = events(checked([...modified(4000), ...unknown(5)]));
      expect(fileParts).toHaveLength(3);
      for (const part of fileParts) expect(bytes(part)).toBeLessThanOrEqual(CONTEXT.maxEventBytes);
      const sent = sentFiles(fileParts);
      expect(sent.every((file) => file.status === "modified")).toBe(true);
      // the start of the list, not a sample
      expect(sent.map((file) => file.path)).toEqual(modified(sent.length).map((file) => file.path));
      expect(state).toMatchObject({ files_truncated: true, unknown_truncated: true });
    });

    it("sends fewer file events when the limit is lower", () => {
      const { state, fileParts } = events(checked([...modified(10), ...unknown(1500)]), 1);
      expect(fileParts).toHaveLength(1);
      expect(fileParts[0]).toMatchObject({ part: 1, parts: 1 });
      expect(bytes(fileParts[0])).toBeLessThanOrEqual(CONTEXT.maxEventBytes);
      expect(fileParts[0]!.files.filter((file) => file.status === "modified")).toHaveLength(10);
      expect(state).toMatchObject({
        file_parts: 1,
        max_file_parts: 1,
        files_truncated: false,
        unknown_truncated: true,
      });
    });

    it("fits each event to a smaller size limit", () => {
      const maxEventBytes = 20 * 1024;
      const folders = Array.from({ length: 3000 }, (_, index) => ({
        folder: `Data/textures/folder${index}`,
        files: index,
        bytes: index * 10,
      }));
      const { state, fileParts } = toGameFolderStateEvents(checked(unknown(1500), folders), {
        ...CONTEXT,
        maxEventBytes,
      });
      expect(fileParts).toHaveLength(3);
      for (const part of fileParts) expect(bytes(part)).toBeLessThanOrEqual(maxEventBytes);
      expect(bytes(state)).toBeLessThanOrEqual(maxEventBytes);
      expect(state).toMatchObject({
        unknown_truncated: true,
        unknown_by_folder_truncated: true,
      });
    });

    it("sends no paths, only the counts, when file events are turned off", () => {
      const folders = [{ folder: "Data/meshes", files: 5, bytes: 50 }];
      const { state, fileParts } = events(checked([...modified(10), ...unknown(5)], folders), 0);
      expect(fileParts).toEqual([]);
      expect(state).toMatchObject({
        file_parts: 0,
        max_file_parts: 0,
        files_truncated: true,
        unknown_truncated: true,
        unknown_by_folder: folders,
      });
    });

    it("cuts the folder totals, smallest first, when the state event is over the limit", () => {
      const folders = Array.from({ length: 3000 }, (_, index) => ({
        folder: `Data/textures/folder${index}`,
        files: index,
        bytes: index * 10,
      }));
      const { state } = events(checked([], folders));
      expect(bytes(state)).toBeLessThanOrEqual(CONTEXT.maxEventBytes);
      expect(state.unknown_by_folder.length).toBeGreaterThan(0);
      expect(state.unknown_by_folder.length).toBeLessThan(3000);
      expect(state.unknown_by_folder[0]!.files).toBe(2999);
      expect(state.unknown_by_folder_truncated).toBe(true);
    });

    it("counts bytes, not characters, for non-ASCII paths", () => {
      const files = Array.from({ length: 4000 }, (_, index) => ({
        path: `Data/テクスチャ/模型/${String(index).padStart(8, "0")}.dds`,
        status: "unknown" as const,
      }));
      const { fileParts } = events(checked(files));
      expect(fileParts).toHaveLength(3);
      for (const part of fileParts) expect(bytes(part)).toBeLessThanOrEqual(CONTEXT.maxEventBytes);
    });
  });
});
