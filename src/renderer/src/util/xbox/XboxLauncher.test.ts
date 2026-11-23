import { describe, it, expect, vi, beforeEach } from "vitest";

import type { IExtensionApi } from "@/types/api";

import type { IXboxEntry } from "./types";
import { XboxLauncher } from "./XboxLauncher";

const mocks = vi.hoisted(() => ({
  shellExecuteEx: vi.fn(),
}));

vi.mock("winapi-bindings", () => ({
  // store detection in the constructor reads the registry; an empty repository
  //  just means "not installed", which these tests don't care about
  WithRegOpen: () => undefined,
  RegEnumKeys: () => [],
  ShellExecuteEx: mocks.shellExecuteEx,
}));

const ENTRY = {
  appid: "Publisher.Game",
  publisherId: "8wekyb3d8bbwe",
  executionName: "DefaultApp",
} as unknown as IXboxEntry;

const target = (execName: string) => `shell:appsFolder\\Publisher.Game_8wekyb3d8bbwe!${execName}`;

// the explorer.exe launch, stubbed so tests never start a real process
let explorerLaunch: ReturnType<typeof vi.fn>;

function makeLauncher(): XboxLauncher {
  const launcher = new XboxLauncher({} as IExtensionApi);
  vi.spyOn(launcher, "findByAppId").mockResolvedValue(ENTRY);
  explorerLaunch = vi.fn().mockResolvedValue(undefined);
  (launcher as unknown as { oneShotLaunch: typeof explorerLaunch }).oneShotLaunch = explorerLaunch;
  return launcher;
}

describe("XboxLauncher.launchGame", () => {
  beforeEach(() => {
    mocks.shellExecuteEx.mockReset();
  });

  it("launches through explorer when there are no arguments", async () => {
    await makeLauncher().launchGame({
      appId: "Publisher.Game",
      parameters: [{ appExecName: "Game" }],
    });

    expect(explorerLaunch).toHaveBeenCalledWith(target("Game"));
    expect(mocks.shellExecuteEx).not.toHaveBeenCalled();
  });

  it("uses the store entry's execution name when no appExecName is given", async () => {
    await makeLauncher().launchGame("Publisher.Game");

    expect(explorerLaunch).toHaveBeenCalledWith(target("DefaultApp"));
  });

  it("does not throw when appId is given without a parameters array", async () => {
    await makeLauncher().launchGame({ appId: "Publisher.Game" });

    expect(explorerLaunch).toHaveBeenCalledWith(target("DefaultApp"));
  });

  it("passes string parameters to the game as arguments", async () => {
    await makeLauncher().launchGame({
      appId: "Publisher.Game",
      parameters: [{ appExecName: "Game" }, "-offline", "-skipintro"],
    });

    expect(mocks.shellExecuteEx).toHaveBeenCalledWith({
      file: target("Game"),
      parameters: "-offline -skipintro",
      show: "shownormal",
    });
    expect(explorerLaunch).not.toHaveBeenCalled();
  });

  it("finds appExecName even when a string parameter comes first", async () => {
    await makeLauncher().launchGame({
      appId: "Publisher.Game",
      parameters: ["-offline", { appExecName: "Game" }],
    });

    expect(mocks.shellExecuteEx).toHaveBeenCalledWith(
      expect.objectContaining({ file: target("Game"), parameters: "-offline" }),
    );
  });

  it("ignores empty string parameters", async () => {
    await makeLauncher().launchGame({
      appId: "Publisher.Game",
      parameters: [{ appExecName: "Game" }, "", "  "],
    });

    expect(explorerLaunch).toHaveBeenCalledWith(target("Game"));
    expect(mocks.shellExecuteEx).not.toHaveBeenCalled();
  });

  it("falls back to launching without arguments if ShellExecuteEx fails", async () => {
    mocks.shellExecuteEx.mockImplementation(() => {
      throw new Error("ShellExecuteEx failed");
    });

    await makeLauncher().launchGame({
      appId: "Publisher.Game",
      parameters: [{ appExecName: "Game" }, "-offline"],
    });

    expect(explorerLaunch).toHaveBeenCalledWith(target("Game"));
  });
});
