import type { EventManualInstaller } from "@vortex/nexus-api-v3";
import { GameId, VortexGameId } from "@vortex/shared";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";

import { isTelemetryEnabled } from "../../../telemetry/selectors";
import type { IModReference } from "../../mod_management/types/IMod";
import { createVortexNexusV3InternalClient } from "../../nexus_integration/nexusV3Client";
import { isLoggedIn } from "../../nexus_integration/selectors";
import { numericNexusGameId } from "../mixpanel/numericGameId";
import {
  buildTelemetryDestination,
  emitManualInstallerEvent,
  type ManualInstallerEventContext,
} from "./manualInstallerEvent";

vi.mock("../../nexus_integration/nexusV3Client", () => ({
  createVortexNexusV3InternalClient: vi.fn(),
}));
vi.mock("../mixpanel/numericGameId", () => ({ numericNexusGameId: vi.fn() }));
vi.mock("../../../telemetry/selectors", () => ({ isTelemetryEnabled: vi.fn() }));
vi.mock("../../nexus_integration/selectors", () => ({ isLoggedIn: vi.fn() }));

const reference = {
  repo: { repository: "nexus", modId: "518", fileId: "138454" },
} as unknown as IModReference;

const context = (
  overrides: Partial<ManualInstallerEventContext> = {},
): ManualInstallerEventContext => ({
  destination: "Data/Sub",
  gameId: VortexGameId("game"),
  modReference: reference,
  ...overrides,
});

const makeApi = () => ({ getState: () => ({}) }) as unknown as IExtensionApi;

const telemetryEvent = vi.fn();

const eventOf = (): EventManualInstaller =>
  telemetryEvent.mock.calls.at(-1)![2] as EventManualInstaller;

beforeEach(() => {
  vi.mocked(isTelemetryEnabled).mockReturnValue(true);
  vi.mocked(isLoggedIn).mockReturnValue(true);
  vi.mocked(numericNexusGameId).mockReturnValue(GameId(1704));
  telemetryEvent.mockReset().mockResolvedValue({ accepted: 1, rejected: [] });
  vi.mocked(createVortexNexusV3InternalClient).mockReturnValue({
    telemetryEvent,
  } as unknown as ReturnType<typeof createVortexNexusV3InternalClient>);
});

describe("buildTelemetryDestination", () => {
  test("the empty folder is the game root", () => {
    expect(buildTelemetryDestination("")).toBe("/");
  });

  test("a folder gets a leading and a trailing slash", () => {
    expect(buildTelemetryDestination("Data")).toBe("/Data/");
  });

  test("windows separators become forward slashes", () => {
    expect(buildTelemetryDestination("Data\\Sub")).toBe("/Data/Sub/");
  });

  test("repeated separators collapse into one", () => {
    expect(buildTelemetryDestination("Data\\Sub\\\\")).toBe("/Data/Sub/");
  });

  test("a path of exactly 256 characters keeps its trailing slash", () => {
    expect(buildTelemetryDestination("a".repeat(254))).toBe(`/${"a".repeat(254)}/`);
  });

  test("a longer path is truncated and so has no trailing slash", () => {
    const truncated = buildTelemetryDestination("a".repeat(255));
    expect(truncated).toHaveLength(256);
    expect(truncated.startsWith(`/${"a".repeat(254)}`)).toBe(true);
    expect(truncated.endsWith("/")).toBe(false);
  });
});

describe("emitManualInstallerEvent", () => {
  test("sends the destination and the nexus ids as numbers", async () => {
    await emitManualInstallerEvent(makeApi(), context({ destination: "Data\\Sub" }));

    expect(eventOf()).toEqual({
      type: "manual_installer",
      version: 1,
      payload: { destination: "/Data/Sub/", game_id: 1704, mod_id: 518, file_id: 138454 },
    });
  });

  test("the game root is sent as a single slash", async () => {
    await emitManualInstallerEvent(makeApi(), context({ destination: "" }));

    expect(eventOf().payload.destination).toBe("/");
  });

  test("an archive without nexus ids reports null for both", async () => {
    await emitManualInstallerEvent(makeApi(), context({ modReference: undefined }));

    expect(eventOf().payload).toEqual({
      destination: "/Data/Sub/",
      game_id: 1704,
      mod_id: null,
      file_id: null,
    });
  });

  test("an unparseable mod id reports null for both ids", async () => {
    await emitManualInstallerEvent(
      makeApi(),
      context({
        modReference: {
          repo: { repository: "nexus", modId: "x", fileId: "1" },
        } as unknown as IModReference,
      }),
    );

    expect(eventOf().payload.mod_id).toBeNull();
    expect(eventOf().payload.file_id).toBeNull();
  });

  test.each(["0", "-1"])("a non-positive mod id means there is none", async (modId) => {
    await emitManualInstallerEvent(
      makeApi(),
      context({
        modReference: {
          repo: { repository: "nexus", modId, fileId: "1" },
        } as unknown as IModReference,
      }),
    );

    expect(eventOf().payload.mod_id).toBeNull();
  });

  test("nothing is sent without analytics consent", async () => {
    vi.mocked(isTelemetryEnabled).mockReturnValue(false);
    await emitManualInstallerEvent(makeApi(), context());

    expect(telemetryEvent).not.toHaveBeenCalled();
  });

  test("nothing is sent when the user isn't logged in", async () => {
    vi.mocked(isLoggedIn).mockReturnValue(false);
    await emitManualInstallerEvent(makeApi(), context());

    expect(telemetryEvent).not.toHaveBeenCalled();
  });

  test("nothing is sent when the nexus game id isn't resolvable", async () => {
    vi.mocked(numericNexusGameId).mockReturnValue(null);
    await emitManualInstallerEvent(makeApi(), context());

    expect(telemetryEvent).not.toHaveBeenCalled();
  });

  test("a failed send is swallowed", async () => {
    telemetryEvent.mockRejectedValue(new Error("socket reset"));

    await expect(emitManualInstallerEvent(makeApi(), context())).resolves.toBeUndefined();
  });
});
