import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeMod, makeProfile, makeProfileMod } from "../../../test-utils/builders";
import { test } from "../../../test-utils/harnessTest";
import type { IApiHarness } from "../../../test-utils/harnessTypes";
import { numericNexusGameId } from "../mixpanel/numericGameId";
import {
  buildModListSnapshot,
  emitModListSnapshot,
  type ModListSnapshot,
  type ModListSnapshotMeta,
} from "./modListSnapshot";

vi.mock("../mixpanel/numericGameId", () => ({ numericNexusGameId: vi.fn() }));

const meta: ModListSnapshotMeta = {
  userId: 123,
  instanceId: "inst-1",
  capturedAt: "2026-07-16T10:00:00.000Z",
  vortexVersion: "2.4.0",
  gameId: 1704,
};

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
      user_id: 123,
      instance_id: "inst-1",
      captured_at: "2026-07-16T10:00:00.000Z",
      vortex_version: "2.4.0",
      game_id: 1704,
    });
    expect(snapshot.mods).toEqual([
      { source: "nexus", mod_id: 111, file_id: 98765, version: "1.0", enabled: true },
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
    expect(snapshot.mods[0]?.mod_id).toBe(1);
  });

  it('defaults a missing source to "unknown"', () => {
    const mods = { a: makeMod({ id: "a", state: "installed", attributes: {} }) };

    const snapshot = buildModListSnapshot(mods, {}, meta);

    expect(snapshot.mods[0]?.source).toBe("unknown");
  });
});

// Slices the api harness does not model (analytics consent, login, instance id, credentials),
// seeded onto its live state through setState for the emit gating tests.
interface SeedState {
  settings: {
    analytics: { enabled: boolean };
    profiles: { lastActiveProfile: Record<string, string> };
  };
  persistent: { nexus: { userInfo?: { userId: number } } };
  app: { instanceId: string };
  confidential: { account: Record<string, unknown> };
}

function seed(
  harness: IApiHarness,
  { enabled = true, loggedIn = true }: { enabled?: boolean; loggedIn?: boolean } = {},
): void {
  harness.setState((draft) => {
    const state = draft as unknown as SeedState;
    state.settings.analytics = { enabled };
    state.settings.profiles.lastActiveProfile = { skyrimse: "p1" };
    state.persistent.nexus = loggedIn ? { userInfo: { userId: 123 } } : {};
    state.app = { instanceId: "inst-1" };
    state.confidential = { account: {} };
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
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 });
    vi.mocked(numericNexusGameId).mockReturnValue(1704);
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("builds and posts the snapshot when consented and logged in", async ({ makeApi }) => {
    const harness = seededHarness(makeApi);
    seed(harness);

    const snapshot = await emitModListSnapshot(harness.api, "skyrimse");

    expect(snapshot).toMatchObject({ user_id: 123, instance_id: "inst-1", game_id: 1704 });
    expect(snapshot?.mods).toEqual([
      { source: "nexus", mod_id: 111, file_id: 98765, version: "1.0", enabled: true },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v3/");
    const body = JSON.parse(init.body as string) as ModListSnapshot;
    expect(body.user_id).toBe(123);
  });

  test("skips (no post) when analytics consent is off", async ({ makeApi }) => {
    const harness = seededHarness(makeApi);
    seed(harness, { enabled: false });

    const snapshot = await emitModListSnapshot(harness.api, "skyrimse");

    expect(snapshot).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("skips (no post) when the user is not logged in", async ({ makeApi }) => {
    const harness = seededHarness(makeApi);
    seed(harness, { loggedIn: false });

    const snapshot = await emitModListSnapshot(harness.api, "skyrimse");

    expect(snapshot).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
