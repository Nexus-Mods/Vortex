import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  log: vi.fn(),
}));

vi.mock("../../logging", () => ({
  log: mocks.log,
}));

import { openFile, openUrl } from "./openTarget";

const shellOpenUrl = vi.fn();
const shellOpenFile = vi.fn();

describe("openTarget", () => {
  beforeEach(() => {
    shellOpenUrl.mockClear();
    shellOpenFile.mockClear();
    mocks.log.mockClear();
    vi.stubGlobal("api", {
      ...window.api,
      shell: { openUrl: shellOpenUrl, openFile: shellOpenFile },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("openUrl", () => {
    it.each([["https://www.nexusmods.com/site/mods/21"], ["mailto:someone@example.com"]])(
      "opens %s",
      (url) => {
        openUrl(url);

        expect(shellOpenUrl).toHaveBeenCalledWith(url);
        expect(mocks.log).not.toHaveBeenCalled();
      },
    );

    it.each([
      ["an empty string", ""],
      ["undefined", undefined],
      ["text that isn't a URL", "not a url"],
      ["a Windows path", "C:\\Games\\Skyrim"],
      ["a relative path", "Data/Mods"],
    ])("drops %s and logs a warning", (_label, url) => {
      openUrl(url as string);

      expect(shellOpenUrl).not.toHaveBeenCalled();
      expect(shellOpenFile).not.toHaveBeenCalled();
      expect(mocks.log).toHaveBeenCalledWith("warn", "not opening an invalid URL", { url });
    });
  });

  describe("openFile", () => {
    it.each([["C:\\Games\\Skyrim"], ["/home/user/Games/skyrim"], ["Data/Mods"]])(
      "opens %s",
      (filePath) => {
        openFile(filePath);

        expect(shellOpenFile).toHaveBeenCalledWith(filePath);
        expect(mocks.log).not.toHaveBeenCalled();
      },
    );

    it.each([
      ["an empty string", ""],
      ["undefined", undefined],
      ["null", null],
    ])("drops %s and logs a warning", (_label, filePath) => {
      openFile(filePath as string);

      expect(shellOpenFile).not.toHaveBeenCalled();
      expect(mocks.log).toHaveBeenCalledWith("warn", "not opening an invalid path", { filePath });
    });
  });
});
