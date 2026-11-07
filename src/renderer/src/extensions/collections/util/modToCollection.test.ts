import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type * as downloadSelectors from "../../download_management/selectors";
import type * as gameSelectors from "../../gamemode_management/selectors";
import type { IMod } from "../../mod_management/types/IMod";
import type * as convertGameIdModule from "../../nexus_integration/util/convertGameId";
import type * as profileSelectors from "../../profile_management/selectors";
import type * as transformCollectionModule from "./transformCollection";

const mocks = vi.hoisted(() => ({
  scanForDiffs: vi.fn(),
}));

vi.mock("../../../logging", () => ({ log: vi.fn() }));

vi.mock("../../../util/fs", () => ({
  ensureDirAsync: vi.fn(async () => undefined),
  ensureDirWritableAsync: vi.fn(async () => undefined),
  removeAsync: vi.fn(async () => undefined),
}));

vi.mock("./binaryPatching", () => ({ scanForDiffs: mocks.scanForDiffs }));
vi.mock("./checksumMatcher", () => ({ matchChecksums: vi.fn() }));
vi.mock("./collectionConfig", () => ({ generateConfig: vi.fn(async () => ({})) }));
vi.mock("./extension", () => ({ findExtensions: () => [] }));
vi.mock("./gameSupport", () => ({ generateGameSpecifics: vi.fn(async () => ({})) }));
vi.mock("../../gamemode_management/util/getGame", () => ({
  getGame: () => ({ id: "fallout4", getInstalledVersion: async () => "1.10.984.0" }),
}));
vi.mock("../../gamemode_management/selectors", async (importOriginal) => ({
  ...(await importOriginal<typeof gameSelectors>()),
  discoveryByGame: () => ({ path: "/game" }),
}));
vi.mock("../../profile_management/selectors", async (importOriginal) => ({
  ...(await importOriginal<typeof profileSelectors>()),
  activeGameId: () => "fallout4",
}));
vi.mock("../../download_management/selectors", async (importOriginal) => ({
  ...(await importOriginal<typeof downloadSelectors>()),
  downloadPathForGame: () => "/downloads",
}));
vi.mock("../../nexus_integration/util/convertGameId", async (importOriginal) => ({
  ...(await importOriginal<typeof convertGameIdModule>()),
  nexusGameId: () => "fallout4",
}));
vi.mock("../../category_management/util/retrieveCategoryPath", () => ({
  resolveCategoryName: () => undefined,
}));
vi.mock("./transformCollection", async (importOriginal) => ({
  ...(await importOriginal<typeof transformCollectionModule>()),
  deduceSource: () => ({
    type: "nexus",
    modId: 1,
    fileId: 2,
    md5: "0123456789abcdef0123456789abcdef",
    fileSize: 100,
    updatePolicy: "exact",
  }),
}));

import { modToCollection } from "./modToCollection";

const collection: IMod = {
  id: "collection1",
  type: "collection",
  state: "installed",
  installationPath: "collection1",
  attributes: {
    name: "Summer Addon",
    collection: { saveEdits: { patched: true } },
  },
  rules: [{ type: "requires", reference: { id: "patched" } }],
};

const patchedMod: IMod = {
  id: "patched",
  type: "",
  state: "installed",
  installationPath: "patched",
  archiveId: "archive1",
  attributes: { name: "Patched Mod", version: "1.0.0" },
  rules: [],
};

const mods: Record<string, IMod> = { collection1: collection, patched: patchedMod };

function makeApi() {
  const state = {
    persistent: { mods: { fallout4: mods }, downloads: { files: {} } },
    settings: { gameMode: { discovered: {} } },
  };
  return {
    getState: () => state,
    lookupModMeta: vi.fn(async () => []),
  } as unknown as IExtensionApi;
}

const exportCollection = (onError: (message: string, replace: any, mayIgnore: boolean) => void) =>
  modToCollection(makeApi(), "fallout4", "/staging", collection, mods, () => undefined, onError);

describe("modToCollection binary patching", () => {
  beforeEach(() => {
    mocks.scanForDiffs.mockReset();
  });

  it("exports the patches it created", async () => {
    mocks.scanForDiffs.mockResolvedValue({ "Patched.esp": "0A1B2C3D" });
    const onError = vi.fn();

    const result = await exportCollection(onError);

    expect(onError).not.toHaveBeenCalled();
    expect(result.mods).toHaveLength(1);
    expect(result.mods[0].patches).toEqual({ "Patched.esp": "0A1B2C3D" });
  });

  it("keeps the mod, without patches, when its patches can't be created", async () => {
    mocks.scanForDiffs.mockRejectedValue(new Error("Archive not found"));
    const onError = vi.fn();

    const result = await exportCollection(onError);

    expect(result.mods).toHaveLength(1);
    expect(result.mods[0].name).toBe("Patched Mod");
    expect(result.mods[0].patches).toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining("binary patches"),
      expect.objectContaining({ modName: "Patched Mod", error: "Archive not found" }),
      true,
    );
  });

  it("still lets the curator cancel the export from the patch dialog", async () => {
    mocks.scanForDiffs.mockRejectedValue(
      Object.assign(new Error("patch too large"), { mayIgnore: false }),
    );
    const onError = vi.fn();

    const result = await exportCollection(onError);

    expect(result.mods).toHaveLength(0);
    expect(onError).toHaveBeenCalledWith(expect.any(String), expect.anything(), false);
  });
});
