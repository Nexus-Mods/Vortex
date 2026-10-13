import type { StoreGameVersionPayload } from "@vortex/nexus-api-v3";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { test } from "../../../test-utils/harnessTest";
import type { IApiHarness } from "../../../test-utils/harnessTypes";
import { getGame, getGameStoresSafe } from "../../gamemode_management/util/getGame";
import { createVortexNexusV3InternalClient } from "../../nexus_integration/nexusV3Client";
import { numericNexusGameId } from "../mixpanel/numericGameId";
import {
  emitStoreGameVersionEvent,
  gogInstallFromInfo,
  resetStoreGameVersionHash,
  steamInstallFromManifest,
  storeGameVersionChangeKey,
} from "./storeGameVersionEvent";

vi.mock("../../nexus_integration/nexusV3Client", () => ({
  createVortexNexusV3InternalClient: vi.fn(),
}));
vi.mock("../mixpanel/numericGameId", () => ({ numericNexusGameId: vi.fn() }));
vi.mock("../../gamemode_management/util/getGame", () => ({
  getGame: vi.fn(),
  getGameStoresSafe: vi.fn(),
}));

// Parsed appmanifest, as simple-vdf leaves it: every leaf is a string.
const APP_STATE = {
  appid: "489830",
  StateFlags: "4",
  buildid: "16659740",
  TargetBuildID: "16659740",
  InstalledDepots: {
    "489831": { manifest: "7997079406114800065", size: "1000" },
    "736261": { manifest: "5847185504493819274", size: "1000", dlcappid: "736260" },
  },
  SharedDepots: { "228990": "228980" },
  UserConfig: { language: "english", BetaKey: "public" },
  MountedConfig: { language: "english" },
};

describe("steamInstallFromManifest", () => {
  it("maps the acf AppState onto the contract", () => {
    expect(steamInstallFromManifest(APP_STATE)).toEqual({
      app_id: 489830,
      build_id: 16659740,
      branch: null,
      language: "english",
      mounted_language: "english",
      state_flags: 4,
      target_build_id: 16659740,
      depots: [
        { depot_id: 489831, manifest_id: "7997079406114800065", dlc_app_id: null },
        { depot_id: 736261, manifest_id: "5847185504493819274", dlc_app_id: "736260" },
      ],
      shared_depots: [{ depot_id: 228990, owner_app_id: 228980 }],
    });
  });

  it("keeps a non-default branch, loses the default", () => {
    expect(steamInstallFromManifest(APP_STATE)?.branch).toBe(null);
    expect(
      steamInstallFromManifest({
        ...APP_STATE,
        UserConfig: { ...APP_STATE.UserConfig, BetaKey: "beta-2" },
      })?.branch,
    ).toBe("beta-2");
  });

  it("keeps depot file order when the caller supplies it", () => {
    // simple-vdf re-sorts the numeric keys, so order arrives from the scan-side regex
    const install = steamInstallFromManifest(
      {
        ...APP_STATE,
        InstalledDepots: {
          "2": { manifest: "mm2" },
          "1": { manifest: "mm1" },
          "3": {},
        },
      },
      ["2", "1", "3"],
    );
    expect(install?.depots).toEqual([
      { depot_id: 2, manifest_id: "mm2", dlc_app_id: null },
      { depot_id: 1, manifest_id: "mm1", dlc_app_id: null },
    ]);
  });

  it("reads a 64-bit id through regex, not JSON.parse", () => {
    // JSON.parse rounds this to ...188; the extractor must see the raw digits.
    expect(
      gogInstallFromInfo(
        '{"rootGameId":1207658924,"buildId": 55136646198962190, "languages": ["en-US","de-DE"]}',
        "1207658924",
      ),
    ).toEqual({
      product_id: "1207658924",
      build_id: "55136646198962190",
      install_language: "en-US",
    });
    expect(gogInstallFromInfo('{"buildId": "123", "language": "English"}', "1207658924")).toEqual({
      product_id: "1207658924",
      build_id: "123",
      install_language: "English",
    });
  });

  it("rejects installs it cannot identify", () => {
    expect(steamInstallFromManifest({ ...APP_STATE, StateFlags: undefined })).toBeNull();
    expect(gogInstallFromInfo('{"languages": ["en-US"]}', "1")).toBeNull();
  });
});

describe("storeGameVersionChangeKey", () => {
  const base: StoreGameVersionPayload = {
    game_id: "1704",
    failure_reason: null,
    exe_version: "1.6.1170.0",
    extension_version: "1.6.1170",
    store: "steam",
    steam: {
      app_id: 489830,
      build_id: 16659740,
      branch: null,
      language: "english",
      mounted_language: "english",
      state_flags: 4,
      target_build_id: 16659740,
      depots: [{ depot_id: 489831, manifest_id: "7997079406114800065", dlc_app_id: null }],
      shared_depots: [],
    },
  };

  it("ignores volatile fields, counts everything else", () => {
    const volatile: StoreGameVersionPayload = {
      ...base,
      steam: { ...base.steam!, state_flags: 2, target_build_id: 17001 },
    };
    expect(storeGameVersionChangeKey(volatile)).toBe(storeGameVersionChangeKey(base));

    expect(
      storeGameVersionChangeKey({ ...base, steam: { ...base.steam!, language: "german" } }),
    ).not.toBe(storeGameVersionChangeKey(base));
    expect(storeGameVersionChangeKey({ ...base, exe_version: "1.7" })).not.toBe(
      storeGameVersionChangeKey(base),
    );
  });
});

// The api harness does not model analytics consent, login credentials, or discovery state;
// seeded onto its live state through setState for the emit gating tests.
interface SeedState {
  settings: {
    analytics: { enabled: boolean };
    gameMode: { discovered: Record<string, { path?: string; store?: string }> };
  };
  app: { instanceId: string };
  confidential: { account: { nexus?: { APIKey?: string } } };
}

const DISCOVERED = {
  skyrimse: { path: "c:\\games\\skyrim", store: "steam" },
};

function seed(
  harness: IApiHarness,
  { enabled = true, loggedIn = true }: { enabled?: boolean; loggedIn?: boolean } = {},
): void {
  harness.setState((draft) => {
    const state = draft as unknown as SeedState;
    state.settings.analytics = { enabled };
    state.settings.gameMode = { discovered: DISCOVERED };
    state.app = { instanceId: "inst-1" };
    state.confidential = { account: loggedIn ? { nexus: { APIKey: "test-api-key" } } : {} };
  });
}

function steamEntry(manifestData: unknown, gamePath = "C:\\Games\\Skyrim"): unknown {
  return {
    appid: "489830",
    name: "Skyrim",
    gamePath,
    gameStoreId: "steam",
    manifestData,
  };
}

function withEntries(...entries: unknown[]): unknown {
  return [{ id: "steam", snapshot: () => ({ entries, isInstalled: true }) }];
}

describe("emitStoreGameVersionEvent", () => {
  const telemetryEvent = vi.fn();

  beforeEach(() => {
    telemetryEvent.mockReset().mockResolvedValue({ accepted: 1, rejected: [] });
    vi.mocked(createVortexNexusV3InternalClient).mockReturnValue({
      telemetryEvent,
    } as unknown as ReturnType<typeof createVortexNexusV3InternalClient>);
    vi.mocked(numericNexusGameId).mockReturnValue(1704);
    vi.mocked(getGame).mockReturnValue({
      version: "1.6.1170",
      getInstalledVersion: vi.fn().mockResolvedValue("1.6.1170.0"),
      details: { steamAppId: 489830 },
    } as unknown as ReturnType<typeof getGame>);
    vi.mocked(getGameStoresSafe).mockReturnValue(
      withEntries(steamEntry({ AppState: APP_STATE })) as never,
    );
    resetStoreGameVersionHash();
  });

  test("posts the steam snapshot once and again only after a change", async ({ makeApi }) => {
    const harness = makeApi();
    seed(harness);

    await emitStoreGameVersionEvent(harness.api, "skyrimse");

    expect(telemetryEvent).toHaveBeenCalledTimes(1);
    const [id, , event] = telemetryEvent.mock.calls[0];
    expect(id).toBeTruthy();
    expect(event).toEqual({
      type: "store_game_version",
      version: 1,
      payload: {
        game_id: "1704",
        failure_reason: null,
        exe_version: "1.6.1170.0",
        extension_version: "1.6.1170",
        store: "steam",
        steam: {
          app_id: 489830,
          build_id: 16659740,
          branch: null,
          language: "english",
          mounted_language: "english",
          state_flags: 4,
          target_build_id: 16659740,
          depots: [
            { depot_id: 489831, manifest_id: "7997079406114800065", dlc_app_id: null },
            { depot_id: 736261, manifest_id: "5847185504493819274", dlc_app_id: "736260" },
          ],
          shared_depots: [{ depot_id: 228990, owner_app_id: 228980 }],
        },
      },
    });

    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).toHaveBeenCalledTimes(1);

    vi.mocked(getGame).mockReturnValue({
      version: "1.6.1170",
      getInstalledVersion: vi.fn().mockResolvedValue("1.7.0.0"),
      details: { steamAppId: 489830 },
    } as unknown as ReturnType<typeof getGame>);
    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).toHaveBeenCalledTimes(2);
    expect(telemetryEvent.mock.calls[1][2].payload.exe_version).toBe("1.7.0.0");
  });

  test("matches the store entry by steam app id when the path diverges", async ({ makeApi }) => {
    const harness = makeApi();
    seed(harness);
    vi.mocked(getGameStoresSafe).mockReturnValue(
      withEntries(steamEntry({ AppState: APP_STATE }, "D:\\somewhere-else")) as never,
    );

    await emitStoreGameVersionEvent(harness.api, "skyrimse");

    expect(telemetryEvent).toHaveBeenCalledTimes(1);
    expect(telemetryEvent.mock.calls[0][2].payload.steam.build_id).toBe(16659740);
  });

  test("sends a failure record instead of staying silent", async ({ makeApi }) => {
    const harness = makeApi();
    seed(harness);
    vi.mocked(getGameStoresSafe).mockReturnValue(withEntries() as never);

    await emitStoreGameVersionEvent(harness.api, "skyrimse");

    const payload = telemetryEvent.mock.calls[0]?.[2].payload;
    expect(payload).toMatchObject({
      game_id: "1704",
      store: "steam",
      steam: null,
      failure_reason: "store-entry-not-found",
      exe_version: "1.6.1170.0",
    });
  });

  test("skips games without a resolvable numeric nexus id", async ({ makeApi }) => {
    const harness = makeApi();
    seed(harness);
    vi.mocked(numericNexusGameId).mockReturnValue(null);

    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).not.toHaveBeenCalled();
  });

  test("skips games not discovered through steam or gog", async ({ makeApi }) => {
    const harness = makeApi();
    seed(harness);
    harness.setState((draft) => {
      (draft as unknown as SeedState).settings.gameMode = {
        discovered: { skyrimse: { path: "c:\\games\\skyrim", store: "epic" } },
      };
    });

    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).not.toHaveBeenCalled();
  });

  test("skips games without a discovery result", async ({ makeApi }) => {
    const harness = makeApi();
    seed(harness);
    harness.setState((draft) => {
      (draft as unknown as SeedState).settings.gameMode = { discovered: {} };
    });

    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).not.toHaveBeenCalled();
  });

  test("is a no-op without consent or login", async ({ makeApi }) => {
    const harness = makeApi();
    seed(harness, { enabled: false });

    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    seed(harness, { enabled: true, loggedIn: false });
    await emitStoreGameVersionEvent(harness.api, "skyrimse");

    expect(telemetryEvent).not.toHaveBeenCalled();
  });
});
