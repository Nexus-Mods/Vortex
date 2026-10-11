import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { api } = vi.hoisted(() => ({
  api: {
    getState: vi.fn(),
    emitAndAwait: vi.fn(),
    sendNotification: vi.fn(),
    showErrorNotification: vi.fn(),
    events: { emit: vi.fn() },
  },
}));

vi.mock("@/contexts", () => ({ useMainContext: () => ({ api }) }));

// A mod has an update when the test says so; the real check reads its source and versions.
vi.mock("../../util/modUpdateState", () => ({
  default: (attributes: { hasUpdate?: boolean }) => (attributes.hasUpdate ? "update" : "current"),
}));

import { useCheckModUpdate } from "./useCheckModUpdate.hook";

const stateWith = (
  mods: { [modId: string]: object },
  modState: { [modId: string]: { enabled: boolean } },
  isPremium = false,
) => ({
  settings: { profiles: { activeProfileId: "profile" } },
  persistent: {
    profiles: { profile: { gameId: "game", modState } },
    mods: { game: mods },
    nexus: { userInfo: { isPremium } },
  },
});

const check = async (modIds: string[]) => {
  const { result } = renderHook(() => useCheckModUpdate());
  await result.current(modIds);
};

describe("useCheckModUpdate", () => {
  it("checks the installed mods it's given, with their profile state", async () => {
    api.getState.mockReturnValue(stateWith({ a: { id: "a" } }, { a: { enabled: true } }));
    api.emitAndAwait.mockResolvedValue([]);

    await check(["a", "missing"]);

    expect(api.emitAndAwait).toHaveBeenCalledWith(
      "check-mods-version",
      "game",
      { a: { id: "a", enabled: true } },
      true,
    );
  });

  it("says how many enabled mods have an update", async () => {
    api.getState.mockReturnValue(
      stateWith(
        { a: { id: "a", attributes: { hasUpdate: true } }, b: { id: "b", attributes: {} } },
        { a: { enabled: true }, b: { enabled: true } },
      ),
    );
    api.emitAndAwait.mockResolvedValue([]);

    await check(["a", "b"]);

    expect(api.sendNotification).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: "1 mod update available", actions: undefined }),
    );
  });

  it("offers a Premium user to update them", async () => {
    api.getState.mockReturnValue(
      stateWith(
        { a: { id: "a", attributes: { hasUpdate: true } } },
        { a: { enabled: true } },
        true,
      ),
    );
    api.emitAndAwait.mockResolvedValue([]);

    await check(["a"]);

    const { actions } = api.sendNotification.mock.lastCall[0];
    actions[0].action(vi.fn());
    expect(api.events.emit).toHaveBeenCalledWith("mods-update", "game", ["a"]);
  });

  it("reports a failed check rather than a result", async () => {
    api.getState.mockReturnValue(stateWith({ a: { id: "a" } }, {}));
    api.emitAndAwait.mockRejectedValue(new Error("offline"));
    api.sendNotification.mockClear();

    await check(["a"]);

    expect(api.showErrorNotification).toHaveBeenCalled();
    expect(api.sendNotification).not.toHaveBeenCalled();
  });
});
