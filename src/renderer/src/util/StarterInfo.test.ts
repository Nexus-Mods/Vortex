import { describe, expect, it, vi } from "vitest";

const launchGameStore = vi.fn();

vi.mock("./GameStoreHelper", () => ({
  default: {
    launchGameStore,
  },
}));

vi.mock("./fs", () => ({}));

describe("StarterInfo", () => {
  it("routes launcher starts through GameStoreHelper.launchGameStore", async () => {
    const StarterInfo = (await import("./StarterInfo.js")).default as any;
    const api = {};
    const info = {
      exePath: "C:/Games/Test/game.exe",
    };

    StarterInfo.runThroughLauncher("gog", info, api, "1495134320");

    expect(launchGameStore).toHaveBeenCalledWith(api, "gog", ["1495134320"]);
  });
});
