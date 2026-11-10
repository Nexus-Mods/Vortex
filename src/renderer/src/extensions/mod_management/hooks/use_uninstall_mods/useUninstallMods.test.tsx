import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { startActivity, stopActivity } from "@/actions/session";
import { ProcessCanceled, UserCanceled } from "@/util/CustomErrors";

const { api, removeMods } = vi.hoisted(() => ({
  api: {
    getState: vi.fn(() => ({ settings: { profiles: { activeProfileId: "p" } } })),
    store: { dispatch: vi.fn() },
    sendNotification: vi.fn(),
    showErrorNotification: vi.fn(),
  },
  removeMods: vi.fn(),
}));

vi.mock("@/contexts", () => ({ useMainContext: () => ({ api }) }));
vi.mock("@/util/selectors", () => ({ activeGameId: () => "game" }));
vi.mock("../../util/removeMods", () => ({ removeMods }));

import { useUninstallMods } from "./useUninstallMods.hook";

const uninstall = (modIds: string[]) => renderHook(() => useUninstallMods()).result.current(modIds);

describe("useUninstallMods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes the mods from the active game, keeping their archives", async () => {
    removeMods.mockResolvedValue(undefined);

    await uninstall(["a", "b"]);

    expect(removeMods).toHaveBeenCalledWith(api, "game", ["a", "b"]);
    expect(api.showErrorNotification).not.toHaveBeenCalled();
  });

  it("lists each mod as uninstalling while it is, and not once done, even on failure", async () => {
    let listed: unknown[] = [];
    removeMods.mockImplementation(async () => {
      listed = api.store.dispatch.mock.calls.map(([action]) => action);
      throw new Error("boom");
    });

    await uninstall(["a", "b"]);

    expect(listed).toEqual([
      startActivity("mods-uninstalling", "a"),
      startActivity("mods-uninstalling", "b"),
    ]);
    expect(api.store.dispatch).toHaveBeenCalledWith(stopActivity("mods-uninstalling", "a"));
    expect(api.store.dispatch).toHaveBeenCalledWith(stopActivity("mods-uninstalling", "b"));
  });

  it("says nothing when the user cancels", async () => {
    removeMods.mockRejectedValue(new UserCanceled());

    await uninstall(["a"]);

    expect(api.sendNotification).not.toHaveBeenCalled();
    expect(api.showErrorNotification).not.toHaveBeenCalled();
  });

  it("warns, rather than reporting an error, when the removal can't go ahead", async () => {
    removeMods.mockRejectedValue(new ProcessCanceled("Deployment is in progress"));

    await uninstall(["a"]);

    expect(api.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "warning", message: "Deployment is in progress" }),
    );
    expect(api.showErrorNotification).not.toHaveBeenCalled();
  });

  it("reports any other failure", async () => {
    const err = new Error("boom");
    removeMods.mockRejectedValue(err);

    await uninstall(["a"]);

    expect(api.showErrorNotification).toHaveBeenCalledWith("Failed to uninstall mods", err, {
      allowReport: true,
    });
  });
});
