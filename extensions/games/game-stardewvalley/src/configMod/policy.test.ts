import { beforeEach, describe, expect, test, vi } from "vitest";

const policyMocks = vi.hoisted(() => ({
  getSafe: vi.fn((value: any, path: Array<string | number>, fallback: any) => {
    const result = path.reduce(
      (acc, key) => (acc == null ? undefined : acc[key]),
      value,
    );
    return result === undefined ? fallback : result;
  }),
}));

vi.mock(
  "vortex-api",
  () =>
    ({
      util: {
        getSafe: policyMocks.getSafe,
      },
    }) as any,
);

import { MOD_TYPE_ROOT, MOD_TYPE_SMAPI } from "../common";
import {
  isModCandidateValid,
  isSmapiInternalPath,
  shouldSuppressSync,
} from "./policy";

describe("configMod/policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("detects SMAPI internal paths across separator and punctuation variants", () => {
    expect(
      isSmapiInternalPath(
        "/home/sewer/Games/Steam/steamapps/common/Stardew Valley/smapi-internal/config.json",
      ),
    ).toBe(true);
    expect(
      isSmapiInternalPath(
        "/home/sewer/Games/Steam/steamapps/common/Stardew Valley/SMAPI_Internal/config.json",
      ),
    ).toBe(true);
    expect(
      isSmapiInternalPath(
        "/home/sewer/Games/Steam/steamapps/common/Stardew Valley/Mods/ContentPatcher/config.json",
      ),
    ).toBe(false);
  });

  test("suppresses sync while dependency installation activity is running", () => {
    const api = {
      getState: () => ({
        session: {
          base: {
            activity: {
              installing_dependencies: ["job-1"],
            },
          },
        },
      }),
    } as any;

    expect(shouldSuppressSync(api)).toBe(true);
  });

  test("does not suppress sync when tracked activities are idle", () => {
    const api = {
      getState: () => ({
        session: {
          base: {
            activity: {
              installing_dependencies: [],
            },
          },
        },
      }),
    } as any;

    expect(shouldSuppressSync(api)).toBe(false);
  });

  test("rejects undefined and root-folder ownership candidates", () => {
    const entry = {
      filePath:
        "/home/sewer/Games/Steam/steamapps/common/Stardew Valley/Mods/ContentPatcher/config.json",
      candidates: ["ContentPatcher"],
    };

    expect(isModCandidateValid(undefined, entry)).toBe(false);
    expect(
      isModCandidateValid(
        { id: "root-pack", type: MOD_TYPE_ROOT } as any,
        entry,
      ),
    ).toBe(false);
  });

  test("accepts non-SMAPI mod candidates", () => {
    const entry = {
      filePath:
        "/home/sewer/Games/Steam/steamapps/common/Stardew Valley/Mods/ContentPatcher/config.json",
      candidates: ["ContentPatcher"],
    };

    expect(
      isModCandidateValid(
        { id: "content-patcher", type: "some-other-type" } as any,
        entry,
      ),
    ).toBe(true);
  });

  test("accepts bundled SMAPI mod ownership when the mod folder matches", () => {
    const entry = {
      filePath:
        "/home/sewer/Games/Steam/steamapps/common/Stardew Valley/Mods/ContentPatcher/config.json",
      candidates: ["ContentPatcher"],
    };

    expect(
      isModCandidateValid(
        {
          id: "content-patcher",
          type: MOD_TYPE_SMAPI,
          attributes: { smapiBundledMods: ["contentpatcher"] },
        } as any,
        entry,
      ),
    ).toBe(true);
  });

  test("rejects SMAPI candidates for files in the game root Content folder", () => {
    const entry = {
      filePath:
        "/home/sewer/Games/Steam/steamapps/common/Stardew Valley/Content/config.json",
      candidates: ["ContentPatcher"],
    };

    expect(
      isModCandidateValid(
        {
          id: "content-patcher",
          type: MOD_TYPE_SMAPI,
          attributes: { smapiBundledMods: ["contentpatcher"] },
        } as any,
        entry,
      ),
    ).toBe(false);
  });

  test("rejects SMAPI candidates when the file path belongs to a different mod folder", () => {
    const entry = {
      filePath:
        "/home/sewer/Games/Steam/steamapps/common/Stardew Valley/Mods/LookupAnything/config.json",
      candidates: ["ContentPatcher"],
    };

    expect(
      isModCandidateValid(
        {
          id: "content-patcher",
          type: MOD_TYPE_SMAPI,
          attributes: { smapiBundledMods: ["contentpatcher"] },
        } as any,
        entry,
      ),
    ).toBe(false);
  });
});
