import { describe, expect, it } from "vitest";

import type { IState } from "../../../types/IState";
import { setDownloadModInfo } from "../../download_management/actions/state";
import { setModAttribute } from "../../mod_management/actions/mods";
import {
  healStoragePathNameActions,
  isStoragePathName,
  stripStoragePathPrefix,
} from "./healStoragePathNames";

const STORAGE_PATH = "5c/d3/1f/5cd31ffe-41b5-4520-8ac2-cc796226941e";

function makeState(input: { downloads?: any; mods?: any }): IState {
  return {
    persistent: {
      downloads: { files: input.downloads ?? {} },
      mods: input.mods ?? {},
    },
  } as unknown as IState;
}

describe("isStoragePathName", () => {
  it("detects CDN storage paths", () => {
    expect(isStoragePathName(STORAGE_PATH)).toBe(true);
    expect(isStoragePathName(`${STORAGE_PATH} - Fix Flickering Particles`)).toBe(true);
  });

  it("leaves ordinary names alone", () => {
    expect(isStoragePathName("Fix Flickering Particles")).toBe(false);
    expect(isStoragePathName("Mods/Textures HD")).toBe(false);
    expect(isStoragePathName(undefined)).toBe(false);
  });
});

describe("stripStoragePathPrefix", () => {
  it("strips the storage-path prefix from a customFileName", () => {
    expect(stripStoragePathPrefix(`${STORAGE_PATH} - Fix Flickering Particles`)).toBe(
      "Fix Flickering Particles",
    );
  });

  it("keeps separators inside the friendly part", () => {
    expect(stripStoragePathPrefix(`${STORAGE_PATH} - SMIM - Special Edition`)).toBe(
      "SMIM - Special Edition",
    );
  });

  it("returns undefined when there is nothing to strip", () => {
    expect(stripStoragePathPrefix("Fix Flickering Particles")).toBeUndefined();
    expect(stripStoragePathPrefix(STORAGE_PATH)).toBeUndefined();
  });
});

describe("healStoragePathNameActions", () => {
  it("replaces a polluted download name with the friendly file name", () => {
    const state = makeState({
      downloads: {
        dl1: {
          modInfo: {
            name: STORAGE_PATH,
            nexus: { fileInfo: { name: "Fix Flickering Particles" } },
          },
        },
      },
    });
    expect(healStoragePathNameActions(state)).toEqual([
      setDownloadModInfo("dl1", "name", "Fix Flickering Particles"),
    ]);
  });

  it("leaves a polluted download alone when no friendly name is available", () => {
    const state = makeState({
      downloads: { dl1: { modInfo: { name: STORAGE_PATH } } },
    });
    expect(healStoragePathNameActions(state)).toEqual([]);
  });

  it("strips the prefix from a polluted customFileName", () => {
    const state = makeState({
      mods: {
        skyrimse: {
          mod1: {
            attributes: { customFileName: `${STORAGE_PATH} - Fix Flickering Particles` },
          },
        },
      },
    });
    expect(healStoragePathNameActions(state)).toEqual([
      setModAttribute("skyrimse", "mod1", "customFileName", "Fix Flickering Particles"),
    ]);
  });

  it("repairs logicalFileName and modName from the mod's download", () => {
    const state = makeState({
      downloads: {
        dl1: {
          modInfo: {
            nexus: {
              fileInfo: { name: "Fix Flickering Particles" },
              modInfo: { name: "Flickering Particles Fix" },
            },
          },
        },
      },
      mods: {
        skyrimse: {
          mod1: {
            archiveId: "dl1",
            attributes: { logicalFileName: STORAGE_PATH, modName: STORAGE_PATH },
          },
        },
      },
    });
    expect(healStoragePathNameActions(state)).toEqual([
      setModAttribute("skyrimse", "mod1", "logicalFileName", "Fix Flickering Particles"),
      setModAttribute("skyrimse", "mod1", "modName", "Flickering Particles Fix"),
    ]);
  });

  it("heals modName from the file name when the mod name is missing (2.4.0-beta.1 cohort)", () => {
    // the 2.4.0-beta.1 GraphQL query never populated nexus.modInfo.name; the file
    // name is the only friendly name available
    const state = makeState({
      downloads: {
        dl1: {
          modInfo: {
            nexus: { fileInfo: { name: "Fix Flickering Particles" }, modInfo: {} },
          },
        },
      },
      mods: {
        skyrimse: {
          mod1: { archiveId: "dl1", attributes: { modName: STORAGE_PATH } },
        },
      },
    });
    expect(healStoragePathNameActions(state)).toEqual([
      setModAttribute("skyrimse", "mod1", "modName", "Fix Flickering Particles"),
    ]);
  });

  it("heals an archiveless mod from the name recovered out of customFileName", () => {
    const state = makeState({
      mods: {
        skyrimse: {
          mod1: {
            attributes: {
              customFileName: `${STORAGE_PATH} - Fix Flickering Particles`,
              logicalFileName: STORAGE_PATH,
              modName: STORAGE_PATH,
            },
          },
        },
      },
    });
    expect(healStoragePathNameActions(state)).toEqual([
      setModAttribute("skyrimse", "mod1", "customFileName", "Fix Flickering Particles"),
      setModAttribute("skyrimse", "mod1", "logicalFileName", "Fix Flickering Particles"),
      setModAttribute("skyrimse", "mod1", "modName", "Fix Flickering Particles"),
    ]);
  });

  it("does nothing for healthy state (idempotent)", () => {
    const state = makeState({
      downloads: {
        dl1: {
          modInfo: {
            name: "Fix Flickering Particles",
            nexus: { fileInfo: { name: "Fix Flickering Particles" } },
          },
        },
      },
      mods: {
        skyrimse: {
          mod1: {
            archiveId: "dl1",
            attributes: {
              customFileName: "Fix Flickering Particles",
              logicalFileName: "Fix Flickering Particles",
            },
          },
        },
      },
    });
    expect(healStoragePathNameActions(state)).toEqual([]);
  });
});
