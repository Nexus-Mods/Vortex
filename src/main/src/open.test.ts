import { describe, expect, it, vi, beforeEach } from "vitest";

const openExternal = vi.fn((_url: string) => Promise.resolve());

vi.mock("electron", () => ({
  shell: { openExternal: (url: string) => openExternal(url) },
}));

vi.mock("./logging", () => ({ log: vi.fn() }));

import { openFile, openUrlString } from "./open";

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

describe("openFile", () => {
  beforeEach(() => openExternal.mockClear());

  it("opens a path through its file:// URL", () => {
    openFile("/games/skyrim");

    // Windows resolves the path onto the current drive, so match only the URL's shape.
    expect(openExternal).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/.*\/games\/skyrim$/),
    );
  });

  // An empty path would resolve to the working directory and open Vortex's own folder.
  it("drops an empty path", () => {
    openFile("");

    expect(openExternal).not.toHaveBeenCalled();
  });

  // The renderer can send whatever it has; a throw from an IPC listener would terminate Vortex.
  it("drops a missing path instead of throwing", () => {
    expect(() => openFile(undefined as unknown as string)).not.toThrow();
    expect(openExternal).not.toHaveBeenCalled();
  });
});
