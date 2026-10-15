import { beforeEach, describe, expect, it, vi } from "vitest";

const { loggedIn, resolveDetectedGames } = vi.hoisted(() => ({
  loggedIn: { current: true },
  resolveDetectedGames: vi.fn(),
}));

vi.mock("@/extensions/nexus_integration/nexusV3Client", () => ({
  createVortexNexusV3Client: () => ({ resolveDetectedGames }),
}));
vi.mock("@/extensions/nexus_integration/selectors", () => ({
  isLoggedIn: () => loggedIn.current,
}));
vi.mock("@/extensions/analytics/utils/detectedGamesEvent", () => ({
  emitDetectedGamesEvent: () => Promise.resolve(),
}));
vi.mock("@/extensions/extension_manager/availableExtensions", () => ({
  finite: (value: unknown) => (Number.isFinite(value) ? value : undefined),
  toAvailableExtension: () => ({}),
}));
vi.mock("@/util/application", () => ({ getApplication: () => ({ version: "1.0.0" }) }));
vi.mock("@/logging", () => ({ log: vi.fn() }));
vi.mock("../getGame", () => ({ getGameStoresSafe: () => [] }));

import { requestDetectedGames, resetDetectedGamesHash } from "./detectedGames";

// --- Helpers ---

const GAME = {
  game_uid: "uid-1",
  game_id: 1,
  image_url: null,
  is_favourite: false,
  store_ids: { steam: [], gog: [], epic: [] },
  extension: null,
};

const makeApi = (failed = false) => {
  const dispatch = vi.fn();
  const api = {
    getState: () => ({
      app: { instanceId: "instance" },
      session: { gameMode: { detectedGamesStatus: failed ? "failed" : undefined } },
    }),
    store: { dispatch },
  };

  return { api, dispatch };
};

/** The status updates dispatched, in order. */
const statuses = (dispatch: ReturnType<typeof vi.fn>) =>
  (dispatch.mock.calls as Array<[{ type: string; payload: unknown }]>)
    .map(([action]) => action)
    .filter((action) => action.type === "SET_DETECTED_GAMES_STATUS")
    .map((action) => action.payload);

// --- Tests ---

describe("requestDetectedGames", () => {
  // The module remembers the last accepted request between calls.
  beforeEach(() => {
    resetDetectedGamesHash();
    loggedIn.current = true;
    resolveDetectedGames.mockReset();
    resolveDetectedGames.mockResolvedValue([GAME]);
  });

  it("stores the games and records the request running, then succeeded", async () => {
    const { api, dispatch } = makeApi();

    await requestDetectedGames(api as never);

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SET_DETECTED_GAMES",
        payload: [expect.objectContaining({ gameUid: "uid-1", gameId: 1 })],
      }),
    );
    expect(statuses(dispatch)).toEqual(["running", "success"]);
  });

  it("records a failure without rejecting", async () => {
    const { api, dispatch } = makeApi();
    resolveDetectedGames.mockRejectedValue(new Error("offline"));

    await expect(requestDetectedGames(api as never)).resolves.toBeUndefined();

    expect(statuses(dispatch)).toEqual(["running", "failed"]);
  });

  it("records no failure for a request that ends after logging out", async () => {
    const { api, dispatch } = makeApi();
    resolveDetectedGames.mockImplementationOnce(() => {
      loggedIn.current = false;
      return Promise.reject(new Error("unauthorised"));
    });

    await requestDetectedGames(api as never);

    expect(statuses(dispatch)).toEqual(["running", undefined]);
  });

  it("sends nothing, and records nothing, while logged out", async () => {
    const { api, dispatch } = makeApi();
    loggedIn.current = false;

    await requestDetectedGames(api as never);

    expect(resolveDetectedGames).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("clears a failure from before logging out", async () => {
    const { api, dispatch } = makeApi(true);
    loggedIn.current = false;

    await requestDetectedGames(api as never);

    expect(resolveDetectedGames).not.toHaveBeenCalled();
    expect(statuses(dispatch)).toEqual([undefined]);
  });

  it("clears an old failure when the payload is one the endpoint accepted", async () => {
    await requestDetectedGames(makeApi().api as never);
    const { api, dispatch } = makeApi(true);

    await requestDetectedGames(api as never);

    expect(resolveDetectedGames).toHaveBeenCalledOnce();
    expect(statuses(dispatch)).toEqual(["success"]);
  });

  it("records a throw before the request as a failure, without rejecting", async () => {
    const { api, dispatch } = makeApi();
    api.getState = () => {
      throw new Error("bad state");
    };

    await expect(requestDetectedGames(api as never)).resolves.toBeUndefined();

    expect(statuses(dispatch)).toEqual(["failed"]);
  });

  it("skips a request whose payload the endpoint already accepted", async () => {
    const { api } = makeApi();

    await requestDetectedGames(api as never);
    await requestDetectedGames(api as never);

    expect(resolveDetectedGames).toHaveBeenCalledOnce();
  });

  it("shares one request between triggers that overlap", async () => {
    const { api } = makeApi();

    await Promise.all([requestDetectedGames(api as never), requestDetectedGames(api as never)]);

    expect(resolveDetectedGames).toHaveBeenCalledOnce();
  });

  it("sends a forced request even when the payload is unchanged", async () => {
    const { api } = makeApi();

    await requestDetectedGames(api as never);
    await requestDetectedGames(api as never, { force: true });

    expect(resolveDetectedGames).toHaveBeenCalledTimes(2);
  });
});
