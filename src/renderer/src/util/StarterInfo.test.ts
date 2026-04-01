import { describe, expect, it, vi } from "vitest";

const launchGame = vi.fn();

vi.mock("./GameStoreHelper", () => ({
  default: {
    launchGame,
  },
}));

vi.mock("./fs", () => ({}));

describe("StarterInfo", () => {
  it("routes launcher starts through GameStoreHelper.launchGame", async () => {
    const StarterInfo = (await import("./StarterInfo.js")).default as any;
    const api = {};
    const info = {
      exePath: "C:/Games/Test/game.exe",
    };

    StarterInfo.runThroughLauncher("gog", info, api, "1495134320");

    expect(launchGame).toHaveBeenCalledWith(api, "gog", "1495134320");
  });
});
