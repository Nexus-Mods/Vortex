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

// A mod has an update when the test says so; the real check reads its source and versions.
vi.mock("../modUpdateState", () => ({
  default: (attributes: { hasUpdate?: boolean }) => (attributes.hasUpdate ? "update" : "current"),
}));

import { checkModUpdates } from "./checkModUpdates";

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

const check = (modIds: string[]) => checkModUpdates(api as never, modIds);

describe("checkModUpdates", () => {
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

  it("calls a collection's new revision a collection update, leaving it out of Update All", async () => {
    api.getState.mockReturnValue(
      stateWith(
        { x: { id: "x", type: "collection", attributes: { name: "Xenon", hasUpdate: true } } },
        { x: { enabled: true } },
        true,
      ),
    );
    api.emitAndAwait.mockResolvedValue([]);

    await check(["x"]);

    expect(api.sendNotification).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: "1 collection update available", actions: undefined }),
    );
  });

  it("counts a collection with mods, offering Update All for the mods alone", async () => {
    api.getState.mockReturnValue(
      stateWith(
        {
          a: { id: "a", attributes: { hasUpdate: true } },
          x: { id: "x", type: "collection", attributes: { name: "Xenon", hasUpdate: true } },
        },
        { a: { enabled: true }, x: { enabled: true } },
        true,
      ),
    );
    api.emitAndAwait.mockResolvedValue([]);

    await check(["a", "x"]);

    const notification = api.sendNotification.mock.lastCall![0];
    expect(notification.message).toBe("2 mod updates available");
    notification.actions[0].action(vi.fn());
    expect(api.events.emit).toHaveBeenLastCalledWith("mods-update", "game", ["a"]);
  });
});
