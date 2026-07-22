import * as path from "path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { forgetExtension } from "../../actions";
import type { IExtension } from "../../types/extensions";
import type { IExtensionApi } from "../../types/IExtensionContext";
import { DataInvalid } from "../../util/CustomErrors";
import {
  clearStaleRemovalFlags,
  validateExtension,
  validateInstall,
  validateTheme,
  validateTranslation,
} from "./installExtension";

// installExtension.ts imports named bindings from "node:fs/promises"; only a full
// vi.mock() factory reliably intercepts those calls (spying on the live module
// object does not, since Vite's ESM handling gives each import site its own
// binding). Mirrors the pattern in reconcileOrphanedArchive.test.ts.
const { statMock, readdirMock } = vi.hoisted(() => ({
  statMock: vi.fn(),
  readdirMock: vi.fn(),
}));

vi.mock("node:fs/promises", () => {
  const mocked = {
    stat: statMock,
    readdir: readdirMock,
    rename: vi.fn(),
    rm: vi.fn(),
    writeFile: vi.fn(),
    access: vi.fn(),
    copyFile: vi.fn(),
    mkdir: vi.fn(),
  };
  return { ...mocked, default: mocked };
});

// Regression test for #23295: previously cleared every `remove: true` flag
// after install, which orphaned old-version folders. Verify path matching
// handles key/folder-name divergence and case-insensitive comparison.
describe("clearStaleRemovalFlags", () => {
  const extensionsPath = path.join("C:", "ProgramData", "vortex", "plugins");

  const makeApi = (
    installed: Record<string, { path: string }>,
  ): { api: IExtensionApi; dispatch: ReturnType<typeof vi.fn> } => {
    const dispatch = vi.fn();
    const api = {
      store: {
        dispatch,
        getState: () => ({ session: { extensions: { installed } } }),
      },
    } as unknown as IExtensionApi;
    return { api, dispatch };
  };

  it("dispatches forgetExtension when a previous entry points at destPath", () => {
    const destPath = path.join(extensionsPath, "ext-name");
    const { api, dispatch } = makeApi({
      "ext-name": { path: destPath },
    });

    clearStaleRemovalFlags(api, ["ext-name"], destPath);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(forgetExtension("ext-name"));
  });

  it("leaves the remove flag set when previous folders are distinct from destPath", () => {
    // ChemBoy1's shape: prior installs sit in version-stamped folders that
    // don't share a path with the new install's destination.
    const destPath = path.join(extensionsPath, "Crimson Desert Vortex Extension v0.4.2");
    const { api, dispatch } = makeApi({
      "Crimson Desert Vortex Extension v0.4.0": {
        path: path.join(extensionsPath, "Crimson Desert Vortex Extension v0.4.0"),
      },
      "Crimson Desert Vortex Extension v0.4.1": {
        path: path.join(extensionsPath, "Crimson Desert Vortex Extension v0.4.1"),
      },
    });

    clearStaleRemovalFlags(
      api,
      ["Crimson Desert Vortex Extension v0.4.0", "Crimson Desert Vortex Extension v0.4.1"],
      destPath,
    );

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("only clears the matching entry when same-path and distinct-path keys are mixed", () => {
    const destPath = path.join(extensionsPath, "ext v2");
    const { api, dispatch } = makeApi({
      "ext v1": { path: path.join(extensionsPath, "ext v1") },
      "ext v2": { path: destPath },
      "ext v0": { path: path.join(extensionsPath, "ext v0") },
    });

    clearStaleRemovalFlags(api, ["ext v1", "ext v2", "ext v0"], destPath);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(forgetExtension("ext v2"));
  });

  it("matches the path even when the state key differs from the folder basename", () => {
    // The case the original `key === path.basename(destPath)` shortcut missed:
    // info.json's `id` field decoupled the state key from the folder name, so
    // a same-folder reinstall would not have cleared the flag and the freshly
    // installed folder would have been wiped on the next launch.
    const destPath = path.join(extensionsPath, "crimson-desert-folder");
    const { api, dispatch } = makeApi({
      "crimson-desert-id": { path: destPath },
    });

    clearStaleRemovalFlags(api, ["crimson-desert-id"], destPath);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(forgetExtension("crimson-desert-id"));
  });

  it("treats path comparison as case-insensitive (Windows filesystem semantics)", () => {
    const destPath = path.join(extensionsPath, "ext-name");
    const { api, dispatch } = makeApi({
      "ext-name": { path: destPath.toUpperCase() },
    });

    clearStaleRemovalFlags(api, ["ext-name"], destPath);

    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("does nothing when there are no matching installed entries", () => {
    const destPath = path.join(extensionsPath, "ext-name");
    const { api, dispatch } = makeApi({});

    clearStaleRemovalFlags(api, [], destPath);
    clearStaleRemovalFlags(api, ["stale-key"], destPath);

    expect(dispatch).not.toHaveBeenCalled();
  });
});

interface FakeDirent {
  name: string;
  isDirectory: () => boolean;
  isFile: () => boolean;
  parentPath?: string;
}

function dir(name: string): FakeDirent {
  return { name, isDirectory: () => true, isFile: () => false };
}

function file(name: string): FakeDirent {
  return { name, isDirectory: () => false, isFile: () => true };
}

describe("validate* extension install checks", () => {
  beforeEach(() => {
    statMock.mockReset();
    readdirMock.mockReset();
  });

  // Resolves readdir() calls based on the path argument, stamping `parentPath`
  // onto each entry the way node:fs/promises does for real Dirents.
  const mockDirTree = (tree: Record<string, FakeDirent[]>): void => {
    readdirMock.mockImplementation(async (p: string) => {
      const entries = tree[p] ?? [];
      return entries.map((entry) => ({ ...entry, parentPath: p }));
    });
  };

  describe("validateExtension", () => {
    const extPath = path.join("mock", "extension");

    it("resolves when index.js and info.json both exist", async () => {
      statMock.mockResolvedValue({} as never);
      await expect(validateExtension(extPath)).resolves.toBeUndefined();
      expect(statMock).toHaveBeenCalledWith(path.join(extPath, "index.js"));
      expect(statMock).toHaveBeenCalledWith(path.join(extPath, "info.json"));
    });

    it("rejects when index.js is missing", async () => {
      statMock.mockImplementation(async (p: string) => {
        if (p.endsWith("index.js")) throw new Error("ENOENT");
        return {} as never;
      });
      await expect(validateExtension(extPath)).rejects.toThrow("ENOENT");
    });

    it("rejects when info.json is missing", async () => {
      statMock.mockImplementation(async (p: string) => {
        if (p.endsWith("info.json")) throw new Error("ENOENT");
        return {} as never;
      });
      await expect(validateExtension(extPath)).rejects.toThrow("ENOENT");
    });
  });

  describe("validateTheme", () => {
    const extPath = path.join("mock", "theme-ext");

    it("throws when there are no subdirectories", async () => {
      mockDirTree({ [extPath]: [file("readme.txt")] });
      await expect(validateTheme(extPath)).rejects.toThrow(
        "Expected a subdirectory containing the stylesheets",
      );
    });

    it.each(["variables.scss", "style.scss", "fonts.scss"])(
      "resolves when the subdirectory contains %s",
      async (required) => {
        const themeDir = path.join(extPath, "default");
        mockDirTree({
          [extPath]: [dir("default")],
          [themeDir]: [file(required)],
        });
        await expect(validateTheme(extPath)).resolves.toBeUndefined();
      },
    );

    it("throws 'Theme not found' when a subdirectory has none of the required files", async () => {
      const themeDir = path.join(extPath, "default");
      mockDirTree({
        [extPath]: [dir("default")],
        [themeDir]: [file("readme.txt")],
      });
      await expect(validateTheme(extPath)).rejects.toThrow("Theme not found");
    });

    it("resolves for a multi-theme extension where every subdirectory is valid", async () => {
      const lightDir = path.join(extPath, "light");
      const darkDir = path.join(extPath, "dark");
      mockDirTree({
        [extPath]: [dir("light"), dir("dark")],
        [lightDir]: [file("variables.scss")],
        [darkDir]: [file("fonts.scss")],
      });
      await expect(validateTheme(extPath)).resolves.toBeUndefined();
    });

    it("throws when at least one of several subdirectories is invalid", async () => {
      const lightDir = path.join(extPath, "light");
      const brokenDir = path.join(extPath, "broken");
      mockDirTree({
        [extPath]: [dir("light"), dir("broken")],
        [lightDir]: [file("variables.scss")],
        [brokenDir]: [file("readme.txt")],
      });
      await expect(validateTheme(extPath)).rejects.toThrow("Theme not found");
    });
  });

  describe("validateTranslation", () => {
    const extPath = path.join("mock", "translation-ext");

    it("throws when there are no locale-like subdirectories", async () => {
      // "docs" isn't a well-formed BCP-47 tag, so Date#toLocaleString rejects
      // it and isLocaleCode filters it out entirely.
      mockDirTree({ [extPath]: [dir("docs"), file("readme.txt")] });
      await expect(validateTranslation(extPath)).rejects.toThrow(
        "Expected exactly one language subdirectory",
      );
    });

    it("throws when there is more than one locale-like subdirectory", async () => {
      mockDirTree({ [extPath]: [dir("en"), dir("de")] });
      await expect(validateTranslation(extPath)).rejects.toThrow(
        "Expected exactly one language subdirectory",
      );
    });

    it("ignores non-locale directories when counting language subdirectories", async () => {
      const langDir = path.join(extPath, "en");
      mockDirTree({
        [extPath]: [dir("docs"), dir("en")],
        [langDir]: [file("strings.json")],
      });
      await expect(validateTranslation(extPath)).resolves.toBeUndefined();
    });

    it("throws 'Directory isn't a language code' for an unrecognized language", async () => {
      // well-formed enough for Date#toLocaleString, but not a real language code
      mockDirTree({ [extPath]: [dir("xx")] });
      await expect(validateTranslation(extPath)).rejects.toThrow("Directory isn't a language code");
    });

    it("throws 'Directory isn't a language code' for a valid language with an invalid country", async () => {
      mockDirTree({ [extPath]: [dir("en-XX")] });
      await expect(validateTranslation(extPath)).rejects.toThrow("Directory isn't a language code");
    });

    it("throws 'No translation files' when the language directory has no json files", async () => {
      const langDir = path.join(extPath, "en");
      mockDirTree({
        [extPath]: [dir("en")],
        [langDir]: [file("readme.txt")],
      });
      await expect(validateTranslation(extPath)).rejects.toThrow("No translation files");
    });

    it("resolves when the language directory contains a json file", async () => {
      const langDir = path.join(extPath, "en");
      mockDirTree({
        [extPath]: [dir("en")],
        [langDir]: [file("strings.json")],
      });
      await expect(validateTranslation(extPath)).resolves.toBeUndefined();
    });
  });

  describe("validateInstall", () => {
    const extPath = path.join("mock", "install-ext");
    const baseInfo: Omit<IExtension, "type"> = {
      name: "some-extension",
      author: "someone",
      description: "a description",
      version: "1.0.0",
    };

    it("delegates to theme validation when info.type is 'theme'", async () => {
      const themeDir = path.join(extPath, "default");
      mockDirTree({
        [extPath]: [dir("default")],
        [themeDir]: [file("variables.scss")],
      });
      const info: IExtension = { ...baseInfo, type: "theme" };
      await expect(validateInstall(extPath, info)).resolves.toBe("theme");
      expect(statMock).not.toHaveBeenCalled();
    });

    it("propagates theme validation failures when info.type is 'theme'", async () => {
      mockDirTree({ [extPath]: [] });
      const info: IExtension = { ...baseInfo, type: "theme" };
      await expect(validateInstall(extPath, info)).rejects.toThrow(DataInvalid);
    });

    it("delegates to translation validation when info.type is 'translation'", async () => {
      const langDir = path.join(extPath, "en");
      mockDirTree({
        [extPath]: [dir("en")],
        [langDir]: [file("strings.json")],
      });
      const info: IExtension = { ...baseInfo, type: "translation" };
      await expect(validateInstall(extPath, info)).resolves.toBe("translation");
    });

    it("only runs validateExtension (no fallback) when info is defined with another type", async () => {
      statMock.mockResolvedValue({} as never);
      const info: IExtension = { ...baseInfo, type: "game" };
      await expect(validateInstall(extPath, info)).resolves.toBe("game");
      expect(readdirMock).not.toHaveBeenCalled();
    });

    it("rejects without falling back to theme/translation when info is defined but validation fails", async () => {
      statMock.mockRejectedValue(new Error("ENOENT"));
      const info: IExtension = { ...baseInfo };
      await expect(validateInstall(extPath, info)).rejects.toThrow("ENOENT");
      expect(readdirMock).not.toHaveBeenCalled();
    });

    it("returns undefined type when info is undefined and the extension validates directly", async () => {
      statMock.mockResolvedValue({} as never);
      await expect(validateInstall(extPath, undefined)).resolves.toBeUndefined();
      expect(readdirMock).not.toHaveBeenCalled();
    });

    it("falls back to theme validation when info is undefined and extension validation fails", async () => {
      statMock.mockRejectedValue(new Error("ENOENT"));
      const themeDir = path.join(extPath, "default");
      mockDirTree({
        [extPath]: [dir("default")],
        [themeDir]: [file("style.scss")],
      });
      await expect(validateInstall(extPath, undefined)).resolves.toBe("theme");
    });

    it("falls back to translation validation when info is undefined and extension/theme validation fail", async () => {
      statMock.mockRejectedValue(new Error("ENOENT"));
      const langDir = path.join(extPath, "en");
      mockDirTree({
        [extPath]: [dir("en")],
        // no theme stylesheet here, so theme validation fails and translation succeeds
        [langDir]: [file("strings.json")],
      });
      await expect(validateInstall(extPath, undefined)).resolves.toBe("translation");
    });

    it("throws when info is undefined and none of extension/theme/translation validate", async () => {
      statMock.mockRejectedValue(new Error("ENOENT"));
      mockDirTree({ [extPath]: [] });
      await expect(validateInstall(extPath, undefined)).rejects.toThrow(
        "Doesn't seem to contain a correctly packaged extension, theme or translation",
      );
    });
  });
});
