import { renderHook } from "@testing-library/react";
import { VortexGameId } from "@vortex/shared";
import { describe, expect, it, vi } from "vitest";

const { api, confirmRemoveMods } = vi.hoisted(() => ({
  api: { getState: vi.fn(() => ({})) },
  confirmRemoveMods: vi.fn(),
}));

vi.mock("@/contexts", () => ({ useMainContext: () => ({ api }) }));
vi.mock("@/util/selectors", async () => {
  const shared = await import("@vortex/shared");
  return { activeGameId: () => shared.VortexGameId("game") };
});
vi.mock("../../util/confirm_remove_mods/confirmRemoveMods", () => ({ confirmRemoveMods }));

import { useRemoveMods } from "./useRemoveMods.hook";

const GAME = VortexGameId("game");

describe("useRemoveMods", () => {
  it("removes the mods from the active game, resolving to whether it finished", async () => {
    confirmRemoveMods.mockResolvedValue(true);

    const remove = renderHook(() => useRemoveMods()).result.current;

    expect(await remove(["a", "b"])).toBe(true);
    expect(confirmRemoveMods).toHaveBeenCalledWith(api, GAME, ["a", "b"]);
  });

  it("keeps the same function across renders", () => {
    const { result, rerender } = renderHook(() => useRemoveMods());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
