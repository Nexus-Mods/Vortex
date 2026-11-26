import { renderHook } from "@testing-library/react";
import { VortexGameId } from "@vortex/shared";
import type { AnyAction } from "redux";
import { batch } from "redux-act";
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
vi.mock("@/util/selectors", async () => {
  const shared = await import("@vortex/shared");
  return { activeGameId: () => shared.VortexGameId("game") };
});
vi.mock("../../util/removeMods", () => ({ removeMods }));

import { useUninstallMods } from "./useUninstallMods.hook";

const GAME = VortexGameId("game");

// What was dispatched, each batch as the actions in it, in order.
const dispatched = () =>
  api.store.dispatch.mock.calls.flatMap(([action]: [AnyAction]) =>
    action.type === batch.getType() ? action.payload : [action],
  );

const uninstall = (modIds: string[]) => renderHook(() => useUninstallMods()).result.current(modIds);

describe("useUninstallMods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes the mods from the active game, keeping their archives", async () => {
    removeMods.mockResolvedValue(undefined);

    expect(await uninstall(["a", "b"])).toBe(true);
    expect(removeMods).toHaveBeenCalledWith(api, GAME, ["a", "b"]);
    expect(api.showErrorNotification).not.toHaveBeenCalled();
  });

  it("lists each mod as uninstalling while it is, and not once done, even on failure", async () => {
    let listed: unknown[] = [];
    removeMods.mockImplementation(async () => {
      listed = dispatched();
      throw new Error("boom");
    });

    await uninstall(["a", "b"]);

    expect(listed).toEqual([
      startActivity("mods-uninstalling", "a"),
      startActivity("mods-uninstalling", "b"),
    ]);
    expect(dispatched().slice(2)).toEqual([
      stopActivity("mods-uninstalling", "a"),
      stopActivity("mods-uninstalling", "b"),
    ]);
  });

  // One store update each way however many mods, so the rows don't each work theirs out again.
  it("lists and unlists the mods in one batch each", async () => {
    removeMods.mockResolvedValue(undefined);

    await uninstall(["a", "b", "c"]);

    expect(api.store.dispatch).toHaveBeenCalledTimes(2);
  });

  it("says nothing when the user cancels", async () => {
    removeMods.mockRejectedValue(new UserCanceled());

    expect(await uninstall(["a"])).toBe(false);

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
