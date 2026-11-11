import * as path from "node:path";

import type { StoreGameVersionPayload } from "@vortex/nexus-api-v3";
import { GameId } from "@vortex/shared";
import { type InMemoryFSBuilder, QualifiedPath } from "@vortex/shared/filesystem";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import type { IHarnessReducerBinding } from "@/test-utils/builders";

import { installInMemoryFS } from "../../../test-utils/fsApi";
import { test } from "../../../test-utils/harnessTest";
import type { IApiHarness } from "../../../test-utils/harnessTypes";
import { getGame, getGameStoresSafe } from "../../gamemode_management/util/getGame";
import { readGameVersions } from "../../gamemode_management/util/getGameVersion";
import { parseGogInfo } from "../../gamemode_management/util/store_install/gogInstall";
import { createVortexNexusV3InternalClient } from "../../nexus_integration/nexusV3Client";
import { numericNexusGameId } from "../mixpanel/numericGameId";
import telemetryReducer from "../reducers/telemetry.reducer";
import {
  emitStoreGameVersions,
  emitStoreGameVersionEvent,
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

describe("parseGogInfo", () => {
  it("reads a 64-bit id through regex, not JSON.parse", () => {
    // JSON.parse rounds this to ...188; the extractor must see the raw digits.
    expect(
      parseGogInfo(
        '{"rootGameId":1207658924,"buildId": 55136646198962190, "languages": ["en-US","de-DE"]}',
      ),
    ).toEqual({ rootGameId: "1207658924", buildId: "55136646198962190", language: "en-US" });
    expect(parseGogInfo('{"buildId": "123", "language": "English"}')).toEqual({
      rootGameId: undefined,
      buildId: "123",
      language: "English",
    });
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

  // persisted caches hold keys in this format: a changed format re-sends every steam install
  it("keeps the persisted steam key format", () => {
    expect(storeGameVersionChangeKey(base)).toBe(
      '["1704",null,"1.6.1170.0","1.6.1170","steam",{"app_id":489830,"build_id":16659740,' +
        '"branch":null,"language":"english","mounted_language":"english","depots":[{"depot_id":' +
        '489831,"manifest_id":"7997079406114800065","dlc_app_id":null}],"shared_depots":[]}]',
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

const manifestPathOf = (appid: string): string => `C:\\Steam\\steamapps\\appmanifest_${appid}.acf`;

/** A store entry as the Steam scan records it; the install data stays in its manifest. */
const steamEntry = (gamePath = "C:\\Games\\Skyrim", appid = "489830"): unknown => ({
  appid,
  name: "Skyrim",
  gamePath,
  gameStoreId: "steam",
  manifestPath: manifestPathOf(appid),
});

const withEntries = (...entries: unknown[]): unknown => [
  { id: "steam", snapshot: () => ({ entries, isInstalled: true }) },
];

/** The appmanifest_<appid>.acf Steam writes for an install. */
const acf = (data: ISteamInstallData): string =>
  [
    '"AppState"',
    "{",
    `  "appid" "${data.appId}"`,
    `  "buildid" "${data.buildId}"`,
    `  "StateFlags" "${data.stateFlags}"`,
    `  "TargetBuildID" "${data.targetBuildId}"`,
    `  "UserConfig" { "language" "${data.language}"${data.branch === null ? "" : ` "BetaKey" "${data.branch}"`} }`,
    `  "MountedConfig" { "language" "${data.mountedLanguage}" }`,
    '  "InstalledDepots"',
    "  {",
    ...data.depots.map(
      (depot) =>
        `    "${depot.depotId}" { "manifest" "${depot.manifestId}"${depot.dlcAppId === null ? "" : ` "dlcappid" "${depot.dlcAppId}"`} }`,
    ),
    "  }",
    '  "SharedDepots"',
    "  {",
    ...data.sharedDepots.map((depot) => `    "${depot.depotId}" "${depot.ownerAppId}"`),
    "  }",
    "}",
  ].join("\n");

// Store files (appmanifests, GOG .info files) live in an in-memory fs per test. Every
// write gets a newer modified time, as a real one does: the store install scans remember
// files by size and modified time, across tests too.
let storeFiles: InMemoryFSBuilder;
let restoreStoreFiles: () => void;
let fileWrites = 0;

beforeEach(() => {
  restoreStoreFiles = installInMemoryFS((builder) => {
    storeFiles = builder;
  }).restore;
});

afterEach(() => restoreStoreFiles());

async function writeStoreFile(nativePath: string, text: string): Promise<void> {
  const file = QualifiedPath.fromNative(nativePath);
  if ((await window.api.fs.stat(file)).exists) {
    await window.api.fs.delete(file);
  }
  storeFiles.file(
    file,
    { type: "text", data: text },
    { modifiedTime: Temporal.Instant.fromEpochMilliseconds(++fileWrites * 1000) },
  );
}

const writeManifest = (data: ISteamInstallData): Promise<void> =>
  writeStoreFile(manifestPathOf(String(data.appId)), acf(data));

describe("emitStoreGameVersionEvent", () => {
  const telemetryEvent = vi.fn();
  const versionSpy = vi.mocked(readGameVersions);

  beforeEach(async () => {
    telemetryEvent.mockReset().mockResolvedValue({ accepted: 1, rejected: [] });
    versionSpy
      .mockReset()
      .mockResolvedValue({ exe: { version: "1.6.1170.0" }, extension: "1.6.1170" });
    vi.mocked(createVortexNexusV3InternalClient).mockReturnValue({
      telemetryEvent,
    } as unknown as ReturnType<typeof createVortexNexusV3InternalClient>);
    vi.mocked(numericNexusGameId).mockReturnValue(GameId(1704));
    vi.mocked(getGame).mockReturnValue({
      details: { steamAppId: 489830 },
    } as unknown as ReturnType<typeof getGame>);
    vi.mocked(getGameStoresSafe).mockReturnValue(withEntries(steamEntry()) as never);
    await writeManifest(INSTALL_DATA);
  });

  test("posts the steam install once and again only after a steam update", async ({ makeApi }) => {
    const harness = makeApi(undefined, [TELEMETRY_BINDING]);
    seed(harness);
    const manifestReads = vi.spyOn(window.api.fs, "readFile");

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
    // an unchanged manifest isn't read again
    expect(manifestReads).toHaveBeenCalledTimes(1);

    // an exe-version-only change does not re-send: the identity is unchanged, so the
    // cheap gate skips before the version lookup happens again
    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).toHaveBeenCalledTimes(1);
    expect(versionSpy).toHaveBeenCalledTimes(1);

    // Steam updates the game while Vortex runs: the scan's entry stays the same, only
    // the manifest moves to the new build id, and that re-sends
    await writeManifest({ ...INSTALL_DATA, buildId: 16659741 });
    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).toHaveBeenCalledTimes(2);
    expect(telemetryEvent.mock.calls[1][2].payload.steam.build_id).toBe(16659741);
    expect(versionSpy).toHaveBeenCalledTimes(2);
  });

  test("reports the game, not a tool sharing its folder", async ({ makeApi }) => {
    const harness = makeApi(undefined, [TELEMETRY_BINDING]);
    seed(harness, { discovered: { skyrimse: { path: "C:\\Games\\Skyrim", store: "steam" } } });
    // the Creation Kit sorts first, as appmanifest_1946180.acf does on NTFS
    await writeManifest({ ...INSTALL_DATA, appId: 1946180 });
    vi.mocked(getGameStoresSafe).mockReturnValue(
      withEntries(steamEntry("C:\\Games\\Skyrim", "1946180"), steamEntry()) as never,
    );

    await emitStoreGameVersionEvent(harness.api, "skyrimse");

    expect(telemetryEvent.mock.calls[0][2].payload.steam.app_id).toBe(489830);
  });

  test("reports the edition a game with several steam ids has installed", async ({ makeApi }) => {
    const harness = makeApi(undefined, [TELEMETRY_BINDING]);
    seed(harness, { discovered: { skyrimse: { path: "C:\\Games\\Skyrim", store: "steam" } } });
    vi.mocked(getGame).mockReturnValue({
      queryArgs: { steam: [{ id: "22300" }, { id: "22370" }] },
    } as unknown as ReturnType<typeof getGame>);
    await writeManifest({ ...INSTALL_DATA, appId: 1946180 });
    await writeManifest({ ...INSTALL_DATA, appId: 22370 });
    vi.mocked(getGameStoresSafe).mockReturnValue(
      withEntries(
        steamEntry("C:\\Games\\Skyrim", "1946180"),
        steamEntry("C:\\Games\\Skyrim", "22370"),
      ) as never,
    );

    await emitStoreGameVersionEvent(harness.api, "skyrimse");

    expect(telemetryEvent.mock.calls[0][2].payload.steam.app_id).toBe(22370);
  });

  test("falls back to the path match for a game declaring no steam ids", async ({ makeApi }) => {
    const harness = makeApi(undefined, [TELEMETRY_BINDING]);
    seed(harness, { discovered: { skyrimse: { path: "C:\\Games\\Skyrim", store: "steam" } } });
    vi.mocked(getGame).mockReturnValue({} as unknown as ReturnType<typeof getGame>);
    await writeManifest({ ...INSTALL_DATA, appId: 22490 });
    vi.mocked(getGameStoresSafe).mockReturnValue(
      withEntries(steamEntry("C:\\Games\\Skyrim", "22490")) as never,
    );

    await emitStoreGameVersionEvent(harness.api, "skyrimse");

    expect(telemetryEvent.mock.calls[0][2].payload.steam.app_id).toBe(22490);
  });

  test("volatile-only changes refresh the gate without a send", async ({ makeApi }) => {
    const harness = makeApi(undefined, [TELEMETRY_BINDING]);
    seed(harness);

    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).toHaveBeenCalledTimes(1);

    // state_flags and target_build_id flip on routine updates; the identity is unchanged
    await writeManifest({ ...INSTALL_DATA, stateFlags: 8, targetBuildId: 17 });
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
      withEntries(steamEntry("D:\\somewhere-else")) as never,
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

    versionSpy.mockResolvedValue({ exe: { failure: "exe-not-found" }, extension: "1.6.1170" });
    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).toHaveBeenCalledTimes(1);
    expect(telemetryEvent.mock.calls[0][2].payload).toMatchObject({
      exe_version: null,
      failure_reason: "exe-not-found",
    });

    // the lookup runs again, but an identical failure is not re-sent
    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(versionSpy).toHaveBeenCalledTimes(2);
    expect(telemetryEvent).toHaveBeenCalledTimes(1);

    // once the lookup recovers, the resolved version goes out and closes the gate
    versionSpy.mockResolvedValue({ exe: { version: "1.6.1170.0" }, extension: "1.6.1170" });
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

    // store entry present, but the manifest lacks the install fields
    await writeStoreFile(manifestPathOf("489830"), '"AppState"\n{\n  "appid" "489830"\n}');
    vi.mocked(getGameStoresSafe).mockReturnValue(withEntries(steamEntry()) as never);
    await emitStoreGameVersionEvent(harness.api, "skyrimse");

    // the manifest is gone since the scan: the game was uninstalled or moved
    await window.api.fs.delete(QualifiedPath.fromNative(manifestPathOf("489830")));
    await emitStoreGameVersionEvent(harness.api, "skyrimse");

    const [missed, unparsed, gone] = telemetryEvent.mock.calls.map((call) => call[2].payload);
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
    expect(gone).toMatchObject({ steam: null, failure_reason: "store-entry-not-found" });
    expect(missed).toMatchObject({ exe_version: "1.6.1170.0" });
  });

  test("keeps the last manifest while Steam holds it locked", async ({ makeApi }) => {
    const harness = makeApi(undefined, [TELEMETRY_BINDING]);
    seed(harness);
    await emitStoreGameVersionEvent(harness.api, "skyrimse");

    // Steam rewrites the manifest and still has it open: nothing is sent until it reads
    await writeManifest({ ...INSTALL_DATA, buildId: 16659741 });
    vi.spyOn(window.api.fs, "readFile").mockRejectedValueOnce(new Error("EBUSY"));
    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).toHaveBeenCalledTimes(1);

    await emitStoreGameVersionEvent(harness.api, "skyrimse");
    expect(telemetryEvent).toHaveBeenCalledTimes(2);
    expect(telemetryEvent.mock.calls[1][2].payload.steam.build_id).toBe(16659741);
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
    manifestPath: manifestPathOf("489831"),
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

  const GOG_INFO_PATH = path.join(GOG_PATH, `goggame-${GOG_ID}.info`);

  beforeEach(async () => {
    telemetryEvent.mockReset().mockResolvedValue({ accepted: 1, rejected: [] });
    vi.mocked(createVortexNexusV3InternalClient).mockReturnValue({
      telemetryEvent,
    } as unknown as ReturnType<typeof createVortexNexusV3InternalClient>);
    vi.mocked(numericNexusGameId).mockImplementation((gameId) => {
      const ids: Record<string, number> = { skyrimse: 1704, witcher3: 1720, skyrimvr: 1705 };
      const numeric = ids[gameId];
      return numeric === undefined ? null : GameId(numeric);
    });

    await writeStoreFile(
      GOG_INFO_PATH,
      JSON.stringify({ rootGameId: 1207658924, buildId: 55136646198962190, languages: ["en-US"] }),
    );
    await writeManifest(INSTALL_DATA);
    await writeManifest(VARIANT);
  });

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
        exe: { version: versions[game.id]?.exe ?? "" },
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

    vi.mocked(getGameStoresSafe).mockReturnValue(steamStoreWith(steamEntry()) as never);

    await emitStoreGameVersions(harness.api);

    expect(telemetryEvent).toHaveBeenCalledTimes(3);
    const gameIds = telemetryEvent.mock.calls.map((call) => call[2].payload.game_id).sort();
    expect(gameIds).toEqual(["1704", "1705", "1720"]);

    // only skyrimse's install identity changes (a steam update wrote a new build id)
    await writeManifest({ ...INSTALL_DATA, buildId: 16659741 });

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

    vi.mocked(getGameStoresSafe).mockReturnValue(steamStoreWith(steamEntry()) as never);

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

    vi.mocked(getGameStoresSafe).mockReturnValue(steamStoreWith(steamEntry()) as never);
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

    vi.mocked(getGameStoresSafe).mockReturnValue(steamStoreWith(steamEntry()) as never);

    await emitStoreGameVersions(harness.api);
    expect(telemetryEvent).toHaveBeenCalledTimes(2);
    const gameIds = telemetryEvent.mock.calls.map((call) => call[2].payload.game_id).sort();
    expect(gameIds).toEqual(["1704", "1705"]);
    expect(exeCalls).toEqual({ skyrimse: 1, skyrimvr: 1 });
  });

  test("a fresh session with unchanged installs sends nothing", async ({ makeApi }) => {
    const exeCalls: Record<string, number> = {};
    const harness = harnessWithVersionLookups(makeApi, exeCalls);

    vi.mocked(getGameStoresSafe).mockReturnValue(steamStoreWith(steamEntry()) as never);

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

    vi.mocked(getGameStoresSafe).mockReturnValue(steamStoreWith(steamEntry()) as never);

    await emitStoreGameVersions(harness.api);
    expect(telemetryEvent).toHaveBeenCalledTimes(3);

    // a new session starts from the persisted cache alone
    const carried = harness.api.getState().persistent.analyticsTelemetry;
    const next = harnessWithVersionLookups(makeApi, exeCalls);
    next.setState((draft) => {
      draft.persistent.analyticsTelemetry = structuredClone(carried);
    });

    // skyrimse's steam update moved its build id
    await writeManifest({ ...INSTALL_DATA, buildId: 16659741 });

    await emitStoreGameVersions(next.api);
    expect(telemetryEvent).toHaveBeenCalledTimes(4);
    expect(telemetryEvent.mock.calls[3][2].payload).toMatchObject({
      game_id: "1704",
      steam: { build_id: 16659741 },
    });
    expect(exeCalls).toEqual({ skyrimse: 2, witcher3: 1, skyrimvr: 1 });
  });

  describe("reports the gog game, not a DLC in its folder", () => {
    // sorts before the game's id, as a DLC's often does
    const DLC_ID = "1207658900";

    /** Emits with the given registry entries and .info files (product id to rootGameId). */
    const emitWithGogFolder = async (
      harness: IApiHarness,
      gogEntries: object[],
      infoFiles: Record<string, string>,
    ): Promise<unknown> => {
      for (const [productId, rootGameId] of Object.entries(infoFiles)) {
        await writeStoreFile(
          path.join(GOG_PATH, `goggame-${productId}.info`),
          `{"gameId": "${productId}", "rootGameId": "${rootGameId}", "buildId": "1"}`,
        );
      }
      vi.mocked(getGameStoresSafe).mockReturnValue([
        {
          id: "steam",
          snapshot: () => ({
            entries: [steamEntry(), SKYRIMVR_ENTRY],
            isInstalled: true,
          }),
        },
        { id: "gog", snapshot: () => ({ entries: gogEntries, isInstalled: true }) },
      ] as never);

      await emitStoreGameVersions(harness.api);
      return telemetryEvent.mock.calls
        .map((call) => call[2].payload)
        .find((payload) => payload.game_id === "1720");
    };

    test("named by the registry, even when the DLC's .info is gone", async ({ makeApi }) => {
      const harness = harnessWithVersionLookups(makeApi, {});
      const dlcEntry = { ...GOG_ENTRY, appid: DLC_ID, name: "DLC", dependsOn: GOG_ID };

      const witcher = await emitWithGogFolder(harness, [dlcEntry, GOG_ENTRY], {
        [GOG_ID]: GOG_ID,
      });

      expect(witcher).toMatchObject({ failure_reason: null, gog: { product_id: GOG_ID } });
    });

    test("named by the DLC's .info where the registry doesn't say", async ({ makeApi }) => {
      const harness = harnessWithVersionLookups(makeApi, {});
      const dlcEntry = { ...GOG_ENTRY, appid: DLC_ID, name: "DLC" };

      const witcher = await emitWithGogFolder(harness, [dlcEntry, GOG_ENTRY], {
        [GOG_ID]: GOG_ID,
        [DLC_ID]: GOG_ID,
      });

      expect(witcher).toMatchObject({ failure_reason: null, gog: { product_id: GOG_ID } });
    });

    // Galaxy was uninstalled, or Windows reset: the game kept its .info files
    test("found by its folder's .info files when the registry lists none", async ({ makeApi }) => {
      const harness = harnessWithVersionLookups(makeApi, {});
      const listings = vi.spyOn(window.api.fs, "enumerateDirectory");

      const witcher = await emitWithGogFolder(harness, [], {
        [DLC_ID]: GOG_ID,
        [GOG_ID]: GOG_ID,
      });

      expect(witcher).toMatchObject({ failure_reason: null, gog: { product_id: GOG_ID } });
      // the next deploy doesn't list the folder again
      await emitStoreGameVersions(harness.api);
      expect(listings).toHaveBeenCalledTimes(1);
    });
  });

  test("re-sends a gog install after a game update", async ({ makeApi }) => {
    const exeCalls: Record<string, number> = {};
    const harness = harnessWithVersionLookups(makeApi, exeCalls);

    vi.mocked(getGameStoresSafe).mockReturnValue(steamStoreWith(steamEntry()) as never);

    await emitStoreGameVersions(harness.api);
    expect(telemetryEvent).toHaveBeenCalledTimes(3);

    // a GOG update rewrites the .info with the new build id
    await writeStoreFile(
      GOG_INFO_PATH,
      '{"rootGameId": 1207658924, "buildId": "58219005939443187", "languages": ["en-US"]}',
    );

    await emitStoreGameVersions(harness.api);
    expect(telemetryEvent).toHaveBeenCalledTimes(4);
    expect(telemetryEvent.mock.calls[3][2].payload).toMatchObject({
      game_id: "1720",
      gog: { product_id: GOG_ID, build_id: "58219005939443187" },
    });
    expect(exeCalls).toEqual({ skyrimse: 1, witcher3: 2, skyrimvr: 1 });
  });
});
