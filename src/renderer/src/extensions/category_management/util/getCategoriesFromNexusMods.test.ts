import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, it, vi, expect } from "vitest";

import getGameCategories from "./getCategoriesFromNexusMods";

vi.mock("@/util/api", () => ({ getApplication: () => ({ version: "1.2.3" }) }));

describe("getCategoriesFromNexusMods", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns categories on success", async () => {
    const categories = [{ id: 1, name: "Cat" }];

    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ categories }),
    });
    const res = await getGameCategories("domain", "token");
    expect(res).toEqual(categories);
  });

  it("identifies itself as mkeiitmods, not Vortex", async () => {
    (globalThis.fetch as Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    await getGameCategories("domain", "token");
    const { headers } = (globalThis.fetch as Mock).mock.calls[0][1];
    expect(headers["Application-Name"]).toBe("mkeiitmods");
    expect(headers["Application-Version"]).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("throws on non-ok response", async () => {
    (globalThis.fetch as Mock).mockResolvedValue({ ok: false, status: 500 });
    await expect(getGameCategories("domain", "token")).rejects.toThrow(
      "Server responded with HTTP 500",
    );
  });

  it("throws a friendly error on network failure", async () => {
    (globalThis.fetch as Mock).mockRejectedValue(new Error("Failed to fetch"));
    await expect(getGameCategories("domain", "token")).rejects.toThrow(
      "An unexpected network error occurred",
    );
  });
});
