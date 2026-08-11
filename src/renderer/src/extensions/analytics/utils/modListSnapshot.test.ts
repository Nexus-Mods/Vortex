import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeMod, makeProfile, makeProfileMod } from "../../../test-utils/builders";
import { test } from "../../../test-utils/harnessTest";
import type { IApiHarness } from "../../../test-utils/harnessTypes";
import { createVortexNexusV3InternalClient } from "../../nexus_integration/nexusV3Client";
import { makeFileUID, makeModUID } from "../../nexus_integration/util/UIDs";
import { numericNexusGameId } from "../mixpanel/numericGameId";
import {
  buildModListSnapshot,
  emitModListSnapshot,
  type ModListSnapshotMeta,
} from "./modListSnapshot";

vi.mock("../mixpanel/numericGameId", () => ({ numericNexusGameId: vi.fn() }));
vi.mock("../../nexus_integration/nexusV3Client", () => ({
  createVortexNexusV3InternalClient: vi.fn(),
}));

const meta: ModListSnapshotMeta = {
  instanceId: "inst-1",
  capturedAt: "2026-07-16T10:00:00.000Z",
  vortexVersion: "2.4.0",
  gameId: 1704,
};

// The endpoint expects Nexus UIDs; assert against the real UID helpers rather than re-deriving.
const NEXUS_A = { gameId: "1704", modId: "111", fileId: "98765" };

describe("buildModListSnapshot", () => {
  it("maps installed mods and reads enabled from the profile mod state", () => {
    const mods = {
      a: makeMod({
        id: "a",
        state: "installed",
        attributes: { source: "nexus", modId: 111, fileId: 98765, version: "1.0" },
      }),
      // Non-Nexus mod: no numeric ids -> nulls, and absent from modState -> disabled.
      b: makeMod({
        id: "b",
        state: "installed",
        attributes: { source: "generic", version: "manual-2.3" },
      }),
    };
    const modState = { a: makeProfileMod({ enabled: true }) };

    const snapshot = buildModListSnapshot(mods, modState, meta);

    expect(snapshot).toMatchObject({
      instance_id: "inst-1",
      captured_at: "2026-07-16T10:00:00.000Z",
      vortex_version: "2.4.0",
      game_id: "1704",
    });
    expect(snapshot.mods).toEqual([
      {
        source: "nexus",
        mod_id: makeModUID(NEXUS_A),
        file_id: makeFileUID(NEXUS_A),
        version: "1.0",
        enabled: true,
      },
      { source: "generic", mod_id: null, file_id: null, version: "manual-2.3", enabled: false },
    ]);
  });

  it("excludes mods that are not fully installed", () => {
    const mods = {
      a: makeMod({ id: "a", state: "installed", attributes: { source: "nexus", modId: 1 } }),
      d: makeMod({ id: "d", state: "downloading", attributes: { source: "nexus", modId: 2 } }),
    };

    const snapshot = buildModListSnapshot(mods, {}, meta);

    expect(snapshot.mods).toHaveLength(1);
    expect(snapshot.mods[0]?.mod_id).toBe(makeModUID({ gameId: "1704", modId: "1", fileId: "" }));
  });

  it('defaults a missing source to "unknown"', () => {
    const mods = { a: makeMod({ id: "a", state: "installed", attributes: {} }) };

    const snapshot = buildModListSnapshot(mods, {}, meta);

    expect(snapshot.mods[0]?.source).toBe("unknown");
  });
});

// Slices the api harness does not model (analytics consent, login credentials, instance id),
// seeded onto its live state through setState for the emit gating tests. `loggedIn` sets the
// Nexus api key, which is what `isLoggedIn` (and the send's auth) reads.
interface SeedState {
  settings: {
    analytics: { enabled: boolean };
    profiles: { lastActiveProfile: Record<string, string> };
  };
  app: { instanceId: string };
  confidential: { account: { nexus?: { APIKey?: string } } };
}

function seed(
  harness: IApiHarness,
  { enabled = true, loggedIn = true }: { enabled?: boolean; loggedIn?: boolean } = {},
): void {
  harness.setState((draft) => {
    const state = draft as unknown as SeedState;
    state.settings.analytics = { enabled };
    state.settings.profiles.lastActiveProfile = { skyrimse: "p1" };
    state.app = { instanceId: "inst-1" };
    state.confidential = { account: loggedIn ? { nexus: { APIKey: "test-api-key" } } : {} };
  });
}

function seededHarness(makeApi: (overrides?: object) => IApiHarness): IApiHarness {
  return makeApi({
    mods: {
      skyrimse: {
        a: makeMod({
          id: "a",
          state: "installed",
          attributes: { source: "nexus", modId: 111, fileId: 98765, version: "1.0" },
        }),
      },
    },
    profiles: {
      p1: makeProfile({
        id: "p1",
        gameId: "skyrimse",
        modState: { a: makeProfileMod({ enabled: true }) },
      }),
    },
  });
}

describe("emitModListSnapshot", () => {
  const submitModLists = vi.fn();

  beforeEach(() => {
    submitModLists.mockReset().mockResolvedValue({ accepted: 1 });
    vi.mocked(createVortexNexusV3InternalClient).mockReturnValue({
      submitModLists,
    } as unknown as ReturnType<typeof createVortexNexusV3InternalClient>);
    vi.mocked(numericNexusGameId).mockReturnValue(1704);
  });

  test("builds and posts the snapshot when consented and logged in", async ({ makeApi }) => {
    const harness = seededHarness(makeApi);
    seed(harness);

    const snapshot = await emitModListSnapshot(harness.api, "skyrimse");

    expect(snapshot).toMatchObject({ instance_id: "inst-1", game_id: "1704" });
    expect(snapshot?.mods).toEqual([
      {
        source: "nexus",
        mod_id: makeModUID(NEXUS_A),
        file_id: makeFileUID(NEXUS_A),
        version: "1.0",
        enabled: true,
      },
    ]);
    expect(submitModLists).toHaveBeenCalledTimes(1);
    const sent = submitModLists.mock.calls[0]?.[0];
    // No user id in the body - the server derives it from the auth token.
    expect(sent).not.toHaveProperty("user");
    expect(sent).not.toHaveProperty("user_id");
    expect(sent.game_id).toBe("1704");
  });

  test("skips (no post) when analytics consent is off", async ({ makeApi }) => {
    const harness = seededHarness(makeApi);
    seed(harness, { enabled: false });

    const snapshot = await emitModListSnapshot(harness.api, "skyrimse");

    expect(snapshot).toBeUndefined();
    expect(submitModLists).not.toHaveBeenCalled();
  });

  test("skips (no post) when the user is not logged in", async ({ makeApi }) => {
    const harness = seededHarness(makeApi);
    seed(harness, { loggedIn: false });

    const snapshot = await emitModListSnapshot(harness.api, "skyrimse");

    expect(snapshot).toBeUndefined();
    expect(submitModLists).not.toHaveBeenCalled();
  });
});
