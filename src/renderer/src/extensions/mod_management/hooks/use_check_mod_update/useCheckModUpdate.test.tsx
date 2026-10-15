import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { api, checkModUpdates } = vi.hoisted(() => ({
  api: { id: "api" },
  checkModUpdates: vi.fn(),
}));

vi.mock("@/contexts", () => ({ useMainContext: () => ({ api }) }));
vi.mock("../../util/check_mod_updates/checkModUpdates", () => ({ checkModUpdates }));

import { useCheckModUpdate } from "./useCheckModUpdate.hook";

describe("useCheckModUpdate", () => {
  it("checks the given mods with the context's api", async () => {
    const { result } = renderHook(() => useCheckModUpdate());

    await result.current(["a", "b"]);

    expect(checkModUpdates).toHaveBeenCalledWith(api, ["a", "b"]);
  });
});
