import * as path from "node:path";

import type { StoreGameVersionPayload } from "@vortex/nexus-api-v3";
import { GameId } from "@vortex/shared";
import { QualifiedPath } from "@vortex/shared/filesystem";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import type { IHarnessReducerBinding } from "@/test-utils/builders";

import { installInMemoryFS } from "../../../test-utils/fsApi";
import { test } from "../../../test-utils/harnessTest";
import type { IApiHarness } from "../../../test-utils/harnessTypes";
import { getGame, getGameStoresSafe } from "../../gamemode_management/util/getGame";
import { readGameVersions } from "../../gamemode_management/util/getGameVersion";
import { createVortexNexusV3InternalClient } from "../../nexus_integration/nexusV3Client";
import { numericNexusGameId } from "../mixpanel/numericGameId";
import telemetryReducer from "../reducers/telemetry.reducer";
import {
  emitStoreGameVersions,
  emitStoreGameVersionEvent,
  gogInstallFromInfo,
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
vi.mock("../../gamemode_management/util/getGameVersion", () => ({
  readGameVersions: vi.fn(),
}));

import type { ISteamInstallData } from "../../../util/Steam";

/** every emit writes its cache through the reducer, so bind it per harness */
const TELEMETRY_BINDING: IHarnessReducerBinding = {
  path: ["persistent", "analyticsTelemetry"],
  reducer: telemetryReducer,
};

// Scan-validated install data, as a steam-kv-parser + zod scan would produce it.
const INSTALL_DATA: ISteamInstallData = {
  appId: 489830,
  buildId: 16659740,
  stateFlags: 4,
  targetBuildId: 16659740,
  branch: null,
  language: "english",
  mountedLanguage: "english",
  depots: [
    { depotId: 489831, manifestId: "7997079406114800065", dlcAppId: null },
    { depotId: 736261, manifestId: "5847185504493819274", dlcAppId: "736260" },
  ],
  sharedDepots: [{ depotId: 228990, ownerAppId: 228980 }],
};

describe("gogInstallFromInfo", () => {
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

  it("rejects content without a build id", () => {
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

function seed(
  harness: IApiHarness,
  {
    enabled = true,
    loggedIn = true,
    discovered = { skyrimse: { path: "c:\\games\\skyrim", store: "steam" } },
    unmanaged = [],
  }: {
    enabled?: boolean;
    loggedIn?: boolean;
    discovered?: Record<string, { path?: string; store?: string }>;
    // game ids present in discovered but intentionally not managed (no profile)
    unmanaged?: string[];
  } = {},
): void {
  harness.setState((draft) => {
    const state = draft as unknown as SeedState;
    state.settings.analytics = { enabled };
    state.settings.gameMode = { discovered };
    state.app = { instanceId: "inst-1" };
    state.confidential = { account: loggedIn ? { nexus: { APIKey: "test-api-key" } } : {} };
    draft.persistent.profiles ??= {};
    for (const gameId of Object.keys(discovered)) {
      if (unmanaged?.includes(gameId)) {
        continue;
      }
      draft.persistent.profiles[`p-${gameId}`] = {
        id: `p-${gameId}`,
        gameId,
      } as never;
    }
  });
}

const steamEntry = (installData?: ISteamInstallData, gamePath = "C:\\Games\\Skyrim"): unknown => ({
  appid: "489830",
  name: "Skyrim",
  gamePath,
  gameStoreId: "steam",
  installData,
});

const withEntries = (...entries: unknown[]): unknown => [
  { id: "steam", snapshot: () => ({ entries, isInstalled: true }) },
];

describe("emitStoreGameVersionEvent", () => {
  const telemetryEvent = vi.fn();
  const versionSpy = vi.mocked(readGameVersions);

  beforeEach(() => {
    telemetryEvent.mockReset().mockResolvedValue({ accepted: 1, rejected: [] });
    versionSpy.mockReset().mockResolvedValue({ exe: "1.6.1170.0", extension: "1.6.1170" });
    vi.mocked(createVortexNexusV3InternalClient).mockReturnValue({
      telemetryEvent,
    } as unknown as ReturnType<typeof createVortexNexusV3InternalClient>);
    vi.mocked(numericNexusGameId).mockReturnValue(GameId(1704));
    vi.mocked(getGame).mockReturnValue({
      details: { steamAppId: 489830 },
    } as unknown as ReturnType<typeof getGame>);
    vi.mocked(getGameStoresSafe).mockReturnValue(withEntries(steamEntry(INSTALL_DATA)) as never);
  });

  test("posts the steam snapshot once and again only after a change", async ({ makeApi }) => {
    const harness = makeApi(undefined, [TELEMETRY_BINDING]);
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
    expect(versionSpy).toHaveBeenCalledTimes(1);

    // an exe-version-only change does not re-send: the identity is unchanged, so the
    // cheap gate skips before the version lookup happens again
    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).toHaveBeenCalledTimes(1);
    expect(versionSpy).toHaveBeenCalledTimes(1);

    // an install-identity change (steam update, new build id) re-sends
    vi.mocked(getGameStoresSafe).mockReturnValue(
      withEntries(steamEntry({ ...INSTALL_DATA, buildId: 16659741 })) as never,
    );
    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).toHaveBeenCalledTimes(2);
    expect(telemetryEvent.mock.calls[1][2].payload.steam.build_id).toBe(16659741);
    expect(versionSpy).toHaveBeenCalledTimes(2);
  });

  test("volatile-only changes refresh the gate without a send", async ({ makeApi }) => {
    const harness = makeApi(undefined, [TELEMETRY_BINDING]);
    seed(harness);

    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).toHaveBeenCalledTimes(1);

    // state_flags and target_build_id flip on routine updates; the identity is unchanged
    vi.mocked(getGameStoresSafe).mockReturnValue(
      withEntries(steamEntry({ ...INSTALL_DATA, stateFlags: 8, targetBuildId: 17 })) as never,
    );
    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).toHaveBeenCalledTimes(1);

    // and the refreshed cache gates the next identical emit
    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).toHaveBeenCalledTimes(1);
  });

  test("matches the store entry by steam app id when the path diverges", async ({ makeApi }) => {
    const harness = makeApi(undefined, [TELEMETRY_BINDING]);
    seed(harness);
    vi.mocked(getGameStoresSafe).mockReturnValue(
      withEntries(steamEntry(INSTALL_DATA), "D:\\somewhere-else") as never,
    );

    await emitStoreGameVersionEvent(harness.api, "skyrimse");

    expect(telemetryEvent).toHaveBeenCalledTimes(1);
    expect(telemetryEvent.mock.calls[0][2].payload.steam.build_id).toBe(16659740);
  });

  test("leaves the cache untouched when the server rejects the event", async ({ makeApi }) => {
    const harness = makeApi(undefined, [TELEMETRY_BINDING]);
    seed(harness);

    telemetryEvent.mockResolvedValueOnce({ accepted: 0, rejected: [{ index: 0 }] });
    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(harness.api.getState().persistent.analyticsTelemetry.storeGameVersions).toEqual({});

    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).toHaveBeenCalledTimes(2);
    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).toHaveBeenCalledTimes(2);
  });

  test("retries a failed version lookup without re-sending the same failure", async ({
    makeApi,
  }) => {
    const harness = makeApi(undefined, [TELEMETRY_BINDING]);
    seed(harness);

    versionSpy.mockResolvedValue({ exe: null, extension: "1.6.1170" });
    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).toHaveBeenCalledTimes(1);
    expect(telemetryEvent.mock.calls[0][2].payload).toMatchObject({
      exe_version: null,
      failure_reason: "version-lookup-failed",
    });

    // the lookup runs again, but an identical failure is not re-sent
    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(versionSpy).toHaveBeenCalledTimes(2);
    expect(telemetryEvent).toHaveBeenCalledTimes(1);

    // once the lookup recovers, the resolved version goes out and closes the gate
    versionSpy.mockResolvedValue({ exe: "1.6.1170.0", extension: "1.6.1170" });
    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).toHaveBeenCalledTimes(2);
    expect(telemetryEvent.mock.calls[1][2].payload).toMatchObject({
      exe_version: "1.6.1170.0",
      failure_reason: null,
    });

    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(versionSpy).toHaveBeenCalledTimes(3);
    expect(telemetryEvent).toHaveBeenCalledTimes(2);
  });

  test("sends failure records instead of staying silent", async ({ makeApi }) => {
    const harness = makeApi(undefined, [TELEMETRY_BINDING]);
    seed(harness);

    // no matching store entry at all
    vi.mocked(getGameStoresSafe).mockReturnValue(withEntries() as never);
    await emitStoreGameVersionEvent(harness.api, "skyrimse");

    // store entry present, but the manifest lacked the install fields
    vi.mocked(getGameStoresSafe).mockReturnValue(withEntries(steamEntry(undefined)) as never);
    await emitStoreGameVersionEvent(harness.api, "skyrimse");

    const [missed, unparsed] = telemetryEvent.mock.calls.map((call) => call[2].payload);
    expect(missed).toMatchObject({
      store: "steam",
      steam: null,
      failure_reason: "store-entry-not-found",
    });
    expect(unparsed).toMatchObject({
      store: "steam",
      steam: null,
      failure_reason: "acf-parse-failed",
    });
    expect(missed).toMatchObject({ exe_version: "1.6.1170.0" });
  });

  test("skips games without a resolvable numeric nexus id", async ({ makeApi }) => {
    const harness = makeApi(undefined, [TELEMETRY_BINDING]);
    seed(harness);
    vi.mocked(numericNexusGameId).mockReturnValue(null);

    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).not.toHaveBeenCalled();
  });

  test("skips games not discovered through steam or gog", async ({ makeApi }) => {
    const harness = makeApi(undefined, [TELEMETRY_BINDING]);
    seed(harness, {
      discovered: { skyrimse: { path: "c:\\games\\skyrim", store: "epic" } },
    });

    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).not.toHaveBeenCalled();
  });

  test("skips games without a discovery result", async ({ makeApi }) => {
    const harness = makeApi(undefined, [TELEMETRY_BINDING]);
    seed(harness, { discovered: {} });

    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).not.toHaveBeenCalled();
  });

  test("is a no-op without consent or login", async ({ makeApi }) => {
    const harness = makeApi(undefined, [TELEMETRY_BINDING]);
    seed(harness, { enabled: false });

    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    seed(harness, { enabled: true, loggedIn: false });
    await emitStoreGameVersionEvent(harness.api, "skyrimse");

    expect(telemetryEvent).not.toHaveBeenCalled();
  });
});

describe("emitStoreGameVersions", () => {
  const telemetryEvent = vi.fn();

  const GOG_ID = "1207658924";
  const GOG_PATH = "C:\\GOG Games\\Witcher3";
  const DISCOVERED_THREE = {
    skyrimse: { path: "c:\\games\\skyrim", store: "steam" },
    witcher3: { path: "c:\\gog games\\witcher3", store: "gog" },
    skyrimvr: { path: "c:\\games\\skyrimvr", store: "steam" },
  };

  const VARIANT: typeof INSTALL_DATA = {
    ...INSTALL_DATA,
    appId: 489831,
    buildId: 73340,
    targetBuildId: 0,
  };

  const SKYRIMVR_ENTRY = {
    appid: "489831",
    name: "Skyrim VR",
    gamePath: "C:\\Games\\SkyrimVR",
    gameStoreId: "steam",
    installData: VARIANT,
  };

  const GOG_ENTRY = { appid: GOG_ID, name: "Witcher 3", gamePath: GOG_PATH, gameStoreId: "gog" };

  const steamStoreWith = (first: unknown): unknown[] => [
    {
      id: "steam",
      snapshot: () => ({ entries: [first, SKYRIMVR_ENTRY], isInstalled: true }),
    },
    {
      id: "gog",
      snapshot: () => ({ entries: [GOG_ENTRY], isInstalled: true }),
    },
  ];

  let restoreFs: () => void;

  beforeEach(() => {
    telemetryEvent.mockReset().mockResolvedValue({ accepted: 1, rejected: [] });
    vi.mocked(createVortexNexusV3InternalClient).mockReturnValue({
      telemetryEvent,
    } as unknown as ReturnType<typeof createVortexNexusV3InternalClient>);
    vi.mocked(numericNexusGameId).mockImplementation((gameId) => {
      const ids: Record<string, number> = { skyrimse: 1704, witcher3: 1720, skyrimvr: 1705 };
      const numeric = ids[gameId];
      return numeric === undefined ? null : GameId(numeric);
    });

    restoreFs = installInMemoryFS((builder) => {
      builder.file(QualifiedPath.fromNative(path.join(GOG_PATH, `goggame-${GOG_ID}.info`)), {
        type: "text",
        data: JSON.stringify({
          rootGameId: 1207658924,
          buildId: 55136646198962190,
          languages: ["en-US"],
        }),
      });
    }).restore;
  });

  afterEach(() => restoreFs());

  const harnessWithVersionLookups = (
    makeApi: (overrides?: object, extraReducers?: IHarnessReducerBinding[]) => IApiHarness,
    exeCalls: Record<string, number>,
    seedOptions?: Parameters<typeof seed>[1],
  ): IApiHarness => {
    const harness = makeApi(undefined, [TELEMETRY_BINDING]);
    seed(harness, { discovered: DISCOVERED_THREE, ...seedOptions });
    const versions: Record<string, { details: unknown; exe: string; extension: string }> = {
      skyrimse: { details: { steamAppId: 489830 }, exe: "1.6.1170.0", extension: "1.6.1170" },
      witcher3: { details: {}, exe: "1.0.5", extension: "1.0" },
      skyrimvr: { details: {}, exe: "1.4.2", extension: "1.4" },
    };
    vi.mocked(getGame).mockImplementation(
      (gameId) =>
        ({
          id: gameId,
          details: versions[gameId]?.details,
        }) as unknown as ReturnType<typeof getGame>,
    );
    vi.mocked(readGameVersions).mockImplementation(async (game) => {
      exeCalls[game.id] = (exeCalls[game.id] ?? 0) + 1;
      return {
        exe: versions[game.id]?.exe ?? null,
        extension: versions[game.id]?.extension ?? null,
      };
    });
    return harness;
  };

  test("sends one record per discovered game and only re-sends the changed one", async ({
    makeApi,
  }) => {
    const exeCalls: Record<string, number> = {};
    const harness = harnessWithVersionLookups(makeApi, exeCalls);

    vi.mocked(getGameStoresSafe).mockReturnValue(steamStoreWith(steamEntry(INSTALL_DATA)) as never);

    await emitStoreGameVersions(harness.api);

    expect(telemetryEvent).toHaveBeenCalledTimes(3);
    const gameIds = telemetryEvent.mock.calls.map((call) => call[2].payload.game_id).sort();
    expect(gameIds).toEqual(["1704", "1705", "1720"]);

    // only skyrimse's install identity changes (a steam update wrote a new build id)
    vi.mocked(getGameStoresSafe).mockReturnValue(
      steamStoreWith(steamEntry({ ...INSTALL_DATA, buildId: 16659741 })) as never,
    );

    await emitStoreGameVersions(harness.api);

    expect(telemetryEvent).toHaveBeenCalledTimes(4);
    expect(telemetryEvent.mock.calls[3][2].payload).toMatchObject({
      game_id: "1704",
      failure_reason: null,
      steam: { build_id: 16659741 },
    });
    // the changed game resolved its version again; the unchanged ones skipped stage 2
    expect(exeCalls).toEqual({ skyrimse: 2, witcher3: 1, skyrimvr: 1 });
  });

  test("retries a failed send on the next deploy without re-sending successes", async ({
    makeApi,
  }) => {
    const exeCalls: Record<string, number> = {};
    const harness = harnessWithVersionLookups(makeApi, exeCalls);

    vi.mocked(getGameStoresSafe).mockReturnValue(steamStoreWith(steamEntry(INSTALL_DATA)) as never);

    telemetryEvent.mockRejectedValueOnce(new Error("socket reset"));
    await emitStoreGameVersions(harness.api);
    expect(telemetryEvent).toHaveBeenCalledTimes(3);

    await emitStoreGameVersions(harness.api);
    expect(telemetryEvent).toHaveBeenCalledTimes(4);
    expect(telemetryEvent.mock.calls[3][2].payload.game_id).toBe("1704");
  });

  test("skips candidates without a resolvable numeric id, others still send", async ({
    makeApi,
  }) => {
    const exeCalls: Record<string, number> = {};
    const harness = harnessWithVersionLookups(makeApi, exeCalls);

    vi.mocked(getGameStoresSafe).mockReturnValue(steamStoreWith(steamEntry(INSTALL_DATA)) as never);
    vi.mocked(numericNexusGameId).mockImplementation((gameId) =>
      gameId === "witcher3" ? null : GameId(1704),
    );

    await emitStoreGameVersions(harness.api);
    expect(telemetryEvent).toHaveBeenCalledTimes(2);
    expect(exeCalls).toEqual({ skyrimse: 1, skyrimvr: 1 });
  });

  test("sends only for managed games: a discovered install without a profile is silent", async ({
    makeApi,
  }) => {
    const exeCalls: Record<string, number> = {};
    const harness = harnessWithVersionLookups(makeApi, exeCalls, { unmanaged: ["witcher3"] });

    vi.mocked(getGameStoresSafe).mockReturnValue(steamStoreWith(steamEntry(INSTALL_DATA)) as never);

    await emitStoreGameVersions(harness.api);
    expect(telemetryEvent).toHaveBeenCalledTimes(2);
    const gameIds = telemetryEvent.mock.calls.map((call) => call[2].payload.game_id).sort();
    expect(gameIds).toEqual(["1704", "1705"]);
    expect(exeCalls).toEqual({ skyrimse: 1, skyrimvr: 1 });
  });

  test("a fresh session with unchanged installs sends nothing", async ({ makeApi }) => {
    const exeCalls: Record<string, number> = {};
    const harness = harnessWithVersionLookups(makeApi, exeCalls);

    vi.mocked(getGameStoresSafe).mockReturnValue(steamStoreWith(steamEntry(INSTALL_DATA)) as never);

    await emitStoreGameVersions(harness.api);
    expect(telemetryEvent).toHaveBeenCalledTimes(3);

    // a new harness hydrates the same cache: a fresh session, nothing changed
    const carried = harness.api.getState().persistent.analyticsTelemetry;
    const nextCalls: Record<string, number> = {};
    const next = harnessWithVersionLookups(makeApi, nextCalls);
    next.setState((draft) => {
      draft.persistent.analyticsTelemetry = structuredClone(carried);
    });

    await emitStoreGameVersions(next.api);
    expect(telemetryEvent).toHaveBeenCalledTimes(3);
    expect(nextCalls).toEqual({});
  });

  test("a fresh session sends only the game whose install changed", async ({ makeApi }) => {
    const exeCalls: Record<string, number> = {};
    const harness = harnessWithVersionLookups(makeApi, exeCalls);

    vi.mocked(getGameStoresSafe).mockReturnValue(steamStoreWith(steamEntry(INSTALL_DATA)) as never);

    await emitStoreGameVersions(harness.api);
    expect(telemetryEvent).toHaveBeenCalledTimes(3);

    // a new session starts from the persisted cache alone
    const carried = harness.api.getState().persistent.analyticsTelemetry;
    const next = harnessWithVersionLookups(makeApi, exeCalls);
    next.setState((draft) => {
      draft.persistent.analyticsTelemetry = structuredClone(carried);
    });

    // skyrimse's steam update moved its build id
    vi.mocked(getGameStoresSafe).mockReturnValue(
      steamStoreWith(steamEntry({ ...INSTALL_DATA, buildId: 16659741 })) as never,
    );

    await emitStoreGameVersions(next.api);
    expect(telemetryEvent).toHaveBeenCalledTimes(4);
    expect(telemetryEvent.mock.calls[3][2].payload).toMatchObject({
      game_id: "1704",
      steam: { build_id: 16659741 },
    });
    expect(exeCalls).toEqual({ skyrimse: 2, witcher3: 1, skyrimvr: 1 });
  });
});
