import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { log } from "@/logging";
import type { IGameInfoEntry } from "@/types/IState";

import { openGameInfoValue } from "./openGameInfoValue";

vi.mock("@/logging", () => ({ log: vi.fn() }));

const openUrl = vi.fn();
const openFile = vi.fn();

const entry = (value: string, type: string, key = "row"): IGameInfoEntry => ({
  key,
  provider: "some-extension",
  priority: 0,
  expires: Number.MAX_SAFE_INTEGER,
  title: "Row",
  value,
  type,
});

describe("openGameInfoValue", () => {
  beforeEach(() => {
    openUrl.mockClear();
    openFile.mockClear();
    vi.mocked(log).mockClear();
    vi.stubGlobal("api", { ...window.api, shell: { openUrl, openFile } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens a path entry as a file", () => {
    openGameInfoValue(entry("C:\\Games\\Skyrim", "path"));

    expect(openFile).toHaveBeenCalledWith("C:\\Games\\Skyrim");
    expect(openUrl).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it("opens a url entry as a url", () => {
    openGameInfoValue(entry("https://example.com/game", "url"));

    expect(openUrl).toHaveBeenCalledWith("https://example.com/game");
    expect(openFile).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it.each([["C:\\Games\\Skyrim"], ["/home/user/Games/skyrim"], ["Data/Mods"]])(
    "opens a url entry holding the path %s as a file and warns",
    (value) => {
      openGameInfoValue(entry(value, "url", value));

      expect(openFile).toHaveBeenCalledWith(value);
      expect(openUrl).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith(
        "warn",
        'Game info entry of type "url" holds a path, give it type "path"',
        { key: value, provider: "some-extension" },
      );
    },
  );

  it("warns once per provider and key however often the entry is opened", () => {
    openGameInfoValue(entry("D:\\Games\\Fallout", "url", "repeated"));
    openGameInfoValue(entry("D:\\Games\\Fallout", "url", "repeated"));
    openGameInfoValue(entry("D:\\Games\\Fallout", "url", "other"));

    expect(openFile).toHaveBeenCalledTimes(3);
    expect(log).toHaveBeenCalledTimes(2);
  });
});
