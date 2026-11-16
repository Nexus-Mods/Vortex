import { V3ApiError, type TelemetryEventEntry } from "@vortex/nexus-api-v3";
import { NexusGameId, VortexGameId } from "@vortex/shared";
import type { GameFolderCheckResult } from "@vortex/shared/ipc";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { createVortexNexusV3InternalClient } from "../../nexus_integration/nexusV3Client";
import { submitGameFolderCheck } from "./submit";

const GAME_ID = VortexGameId("skyrimse");

vi.mock("../../nexus_integration/nexusV3Client", () => ({
  createVortexNexusV3InternalClient: vi.fn(),
}));
vi.mock("../mixpanel/numericGameId", () => ({ numericNexusGameId: () => NexusGameId(1704) }));
vi.mock("../../../util/log", () => ({ log: vi.fn() }));
vi.mock("./steamInput", () => ({ steamEntryFor: () => undefined }));
vi.mock("./scheduler", () => ({
  gameFolderCheckMarkers: () => ({ skyrimse: { state: "pending", managedAt: 0 } }),
}));
vi.mock("./config", () => ({
  MAX_BATCH_BYTES: 240 * 1024,
  flaggedGameFolderCheckConfig: () => ({ maxFileParts: 6, maxEventBytes: 60 * 1024 }),
  gameFolderCheckConfig: () => ({ maxFileParts: 6, maxEventBytes: 60 * 1024 }),
}));

const count = (files: number) => ({ files, bytes: files * 10 });

/** A checked folder with this many unknown files, at about 100 bytes a path. */
function checked(unknownFiles: number): GameFolderCheckResult {
  return {
    status: "checked",
    verification: { status: "checked", reason: null },
    deployedBeforeCheck: false,
    files: Array.from({ length: unknownFiles }, (_, index) => ({
      path: `Data/meshes/actors/character/facegendata/facegeom/Skyrim.esm/${String(index).padStart(8, "0")}.nif`,
      status: "unknown" as const,
    })),
    unknownTruncated: false,
    unknownByFolder: [],
    counts: {
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
      unknown: count(unknownFiles),
      unknownInVortexFolder: count(0),
      vortex: count(0),
      vortexChangedSinceDeploy: count(0),
    },
    input: {
      gameId: GAME_ID,
      appId: 489830,
      buildId: 1,
      targetBuildId: 1,
      depots: [],
      fullVerify: false,
      limits: {
        maxDurationMs: 1,
        maxBytes: 1,
        hashConcurrency: 1,
        hashSampleExecutables: 1,
        hashSampleFiles: 1,
        maxUnknownPaths: 10_000,
      },
    },
    folderCreatedAt: null,
    manifestCreatedAt: {},
    cost: { durationMs: 1, filesWalked: 0, bytesRead: 0 },
  };
}

describe("submitGameFolderCheck", () => {
  const telemetryEvents = vi.fn<(events: TelemetryEventEntry[]) => Promise<unknown>>();
  const dispatch = vi.fn();
  const api = { getState: () => ({}), store: { dispatch } } as unknown as IExtensionApi;
  const markers = () => dispatch.mock.calls.map(([action]) => action.payload.marker);
  const sentTypes = () =>
    telemetryEvents.mock.calls.map(([events]) => events.map((entry) => entry.event.type));

  beforeEach(() => {
    dispatch.mockReset();
    telemetryEvents.mockReset().mockResolvedValue({ accepted: 1, rejected: [] });
    vi.mocked(createVortexNexusV3InternalClient).mockReturnValue({
      telemetryEvents,
    } as unknown as ReturnType<typeof createVortexNexusV3InternalClient>);
  });

  it("sends a clean folder as one request holding the state event", async () => {
    await submitGameFolderCheck(api, checked(0));
    expect(sentTypes()).toEqual([["game_folder_state"]]);
    expect(markers()).toEqual([{ state: "done", status: "checked", at: expect.any(Number) }]);
  });

  it("sends a small check's file events and state event in one request, state last", async () => {
    await submitGameFolderCheck(api, checked(1000));
    expect(sentTypes()).toEqual([
      ["game_folder_state_files", "game_folder_state_files", "game_folder_state"],
    ]);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("spreads a large check over several requests, with the state event in the last", async () => {
    await submitGameFolderCheck(api, checked(2800));
    expect(sentTypes()).toEqual([
      Array.from({ length: 4 }, () => "game_folder_state_files"),
      ["game_folder_state_files", "game_folder_state"],
    ]);
    const sent = telemetryEvents.mock.calls.flatMap(([events]) => events);
    const checkIds = sent.map((entry) => (entry.event.payload as { check_id?: string }).check_id);
    expect(checkIds[0]).toBeTypeOf("string");
    expect(new Set(checkIds).size).toBe(1);
    expect(new Set(sent.map((entry) => entry.id)).size).toBe(sent.length);
    expect(sent.at(-1)!.event.payload).toMatchObject({ file_parts: 5, unknown_truncated: false });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("stops before the state event and leaves the check pending when a request fails", async () => {
    telemetryEvents.mockRejectedValueOnce(new Error("socket reset"));
    await expect(submitGameFolderCheck(api, checked(2800))).rejects.toThrow("socket reset");
    expect(sentTypes()).toEqual([Array.from({ length: 4 }, () => "game_folder_state_files")]);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("leaves the check pending when the API is unavailable", async () => {
    telemetryEvents.mockRejectedValueOnce(new V3ApiError({ status: 503, title: "Unavailable" }));
    await expect(submitGameFolderCheck(api, checked(0))).rejects.toThrow("Unavailable");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("drops the check when the API rejects an event, without sending the rest", async () => {
    telemetryEvents.mockResolvedValueOnce({ accepted: 3, rejected: [{ index: 0 }] });
    await submitGameFolderCheck(api, checked(2800));
    expect(telemetryEvents).toHaveBeenCalledTimes(1);
    expect(markers()).toEqual([
      { state: "dropped", reason: "events_rejected", at: expect.any(Number) },
    ]);
  });

  it.each([413, 422])("drops the check when the API refuses a batch with %i", async (status) => {
    telemetryEvents.mockRejectedValueOnce(new V3ApiError({ status, title: "Refused" }));
    await submitGameFolderCheck(api, checked(2800));
    expect(telemetryEvents).toHaveBeenCalledTimes(1);
    expect(markers()).toEqual([
      { state: "dropped", reason: `http_${status}`, at: expect.any(Number) },
    ]);
  });
});
