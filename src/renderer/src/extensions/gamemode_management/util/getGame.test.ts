import { describe, expect, it } from "vitest";

describe("getGame module", () => {
  it("does not expose the removed getGameStore helper", async () => {
    const mod = await import("./getGame.js");

    expect("getGameStore" in mod).toBe(false);
  });
});
