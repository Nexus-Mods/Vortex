import { describe, expect, it, vi, beforeEach } from "vitest";

const openExternal = vi.fn((_url: string) => Promise.resolve());

vi.mock("electron", () => ({
  shell: { openExternal: (url: string) => openExternal(url) },
}));

vi.mock("./logging", () => ({ log: vi.fn() }));

import { openUrlString } from "./open";

describe("openUrlString", () => {
  beforeEach(() => openExternal.mockClear());

  it("opens a valid URL", () => {
    openUrlString("https://www.nexusmods.com/skyrimspecialedition/mods/1");

    expect(openExternal).toHaveBeenCalledWith(
      "https://www.nexusmods.com/skyrimspecialedition/mods/1",
    );
  });

  it("drops a value that isn't a URL instead of throwing", () => {
    expect(() => openUrlString("example.com")).not.toThrow();
    expect(openExternal).not.toHaveBeenCalled();
  });
});
