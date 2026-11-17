import { NexusGameDomain, VortexGameId } from "@vortex/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IDownload } from "@/extensions/download_management/types/IDownload";
import type { IMod } from "@/extensions/mod_management/types/IMod";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";

import {
  archiveUsersOf,
  deleteModFiles,
  isUninstallingIn,
  removalCounts,
  type IOwnedModFileSources,
  type OwnedModFile,
  ownedModFiles,
} from "./deleteModFiles";

const mocks = vi.hoisted(() => ({
  uninstallMods: vi.fn(),
  /** The game's mods once uninstalling is done. */
  modsAfter: {} as Record<string, unknown>,
  /** Another game's mods. */
  otherGameMods: {} as Record<string, unknown>,
}));

vi.mock("@/extensions/mod_management/util/uninstall_mods/uninstallMods", () => ({
  UNINSTALLING_ACTIVITY: "mods-uninstalling",
  uninstallMods: mocks.uninstallMods,
}));
vi.mock("@/extensions/browse_nexus/hooks/use_mod_install_state/modInstallSelectors", () => ({
  gameDomains: () => () => undefined,
  modInstallGroups: () =>
    new Map([["skyrimspecialedition/1", { mods: ["skyui", "skyui-lite"], downloads: [] }]]),
}));

const gameId = VortexGameId("skyrimse");

const mod = (id: string, overrides: Partial<IMod> = {}): IMod =>
  ({
    id,
    state: "installed",
    type: "",
    installationPath: id,
    attributes: { name: id, version: "1.0", source: "nexus", modId: 1, downloadGame: "skyrimse" },
    ...overrides,
  }) as IMod;

const download = (overrides: Partial<IDownload> = {}): IDownload =>
  ({
    state: "finished",
    game: ["skyrimse"],
    localPath: "patch.7z",
    modInfo: {
      nexus: {
        ids: { gameId: "skyrimspecialedition", modId: 1 },
        fileInfo: { name: "Patch", version: "2.0" },
      },
    },
    ...overrides,
  }) as IDownload;

const installedFile: OwnedModFile = {
  kind: "installed",
  modId: "skyui",
  archiveId: "dl-skyui",
  hasDownload: true,
  otherArchiveUsers: [],
  name: "SkyUI",
};

const downloadedFile: OwnedModFile = { kind: "downloaded", downloadId: "dl-patch", name: "Patch" };

let api: IExtensionApi;
let emit: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mocks.uninstallMods.mockReset().mockResolvedValue(true);
  mocks.modsAfter = {};
  mocks.otherGameMods = {};
  emit = vi.fn((_event: string, _id: string, callback?: (err: Error | null) => void) =>
    callback?.(null),
  );
  api = {
    events: { emit },
    showErrorNotification: vi.fn(),
    getState: () => ({
      persistent: { mods: { skyrimse: mocks.modsAfter, fallout4: mocks.otherGameMods } },
    }),
  } as unknown as IExtensionApi;
});

/** The archives `remove-download` was asked to delete. */
const deletedDownloads = () =>
  emit.mock.calls.filter(([event]) => event === "remove-download").map(([, id]) => id);

/** SkyUI's files among these sources, matched by its key as the button matches them. */
const ownedOf = (
  sources: Omit<IOwnedModFileSources, "key" | "domainOf" | "archiveUsers">,
  otherGames: Record<string, Record<string, IMod>> = {},
) =>
  ownedModFiles({
    ...sources,
    key: "skyrimspecialedition/1",
    domainOf: () => NexusGameDomain("skyrimspecialedition"),
    archiveUsers: archiveUsersOf({ ...otherGames, [sources.gameId]: sources.mods }, sources.gameId),
  });

describe("ownedModFiles", () => {
  it("lists the mod's installed mods, then downloads nothing is installed from", () => {
    const files = ownedOf({
      mods: { skyui: mod("skyui", { archiveId: "dl-skyui" }) },
      downloads: { "dl-skyui": download(), "dl-patch": download() },
      gameId,
    });

    expect(files).toEqual([
      {
        kind: "installed",
        modId: "skyui",
        archiveId: "dl-skyui",
        hasDownload: true,
        otherArchiveUsers: [],
        name: "skyui (v1.0)",
      },
      { kind: "downloaded", downloadId: "dl-patch", name: "Patch (v2.0)" },
    ]);
  });

  it("names an installed mod with no stored name by its id, never leaving it blank", () => {
    const [file] = ownedOf({
      mods: {
        skyui: mod("skyui", {
          installationPath: "",
          attributes: { ...mod("x").attributes, name: undefined },
        }),
      },
      downloads: {},
      gameId,
    });

    expect(file.name).toBe("skyui (v1.0)");
  });

  it("lists the other mods installed from each installed file's download", () => {
    const files = ownedOf({
      mods: {
        a: mod("a", { archiveId: "dl-shared" }),
        b: mod("b", { archiveId: "dl-shared" }),
      },
      downloads: { "dl-shared": download() },
      gameId,
    });

    expect(files.map((file) => file.kind === "installed" && file.otherArchiveUsers)).toEqual([
      ["b"],
      ["a"],
    ]);
  });

  it("marks an installed mod whose download Vortex no longer has", () => {
    const files = ownedOf({
      mods: { gone: mod("gone", { archiveId: "dl-gone" }), local: mod("local") },
      downloads: {},
      gameId,
    });

    expect(files.map((file) => file.kind === "installed" && file.hasDownload)).toEqual([
      false,
      false,
    ]);
  });

  it("leaves out a download a mod in another game is installed from", () => {
    const files = ownedOf(
      {
        mods: {},
        downloads: { "dl-shared": download({ game: ["skyrimse", "skyrimvr"] }) },
        gameId,
      },
      { skyrimvr: { vr: mod("vr", { archiveId: "dl-shared" }) } },
    );

    expect(files).toEqual([]);
  });

  it("counts only finished installs and downloads in this game", () => {
    const files = ownedOf({
      mods: {
        installing: mod("installing", { state: "installing" }),
        collection: mod("collection", { type: "collection" }),
      },
      downloads: {
        running: download({ state: "started" }),
        "other-game": download({ game: ["fallout4"] }),
      },
      gameId,
    });

    expect(files).toEqual([]);
  });
});

describe("deleteModFiles", () => {
  it("uninstalls installed files and deletes downloads, keeping installed files' archives", async () => {
    await deleteModFiles(api, gameId, [installedFile, downloadedFile], { deleteArchives: false });

    expect(mocks.uninstallMods).toHaveBeenCalledWith(api, gameId, ["skyui"]);
    expect(emit.mock.calls).toEqual([
      ["remove-download", "dl-patch", expect.any(Function), { confirmed: true }],
    ]);
  });

  it("deletes the archives of the files it uninstalled when asked", async () => {
    await deleteModFiles(api, gameId, [installedFile], { deleteArchives: true });

    expect(deletedDownloads()).toEqual(["dl-skyui"]);
  });

  it("keeps the archive of a mod that failed to uninstall", async () => {
    mocks.modsAfter = { skyui: mod("skyui", { archiveId: "dl-skyui" }) };

    await deleteModFiles(api, gameId, [installedFile], { deleteArchives: true });

    expect(deletedDownloads()).toEqual([]);
  });

  it.each([
    [
      "in this game",
      () => (mocks.modsAfter = { variant: mod("variant", { archiveId: "dl-skyui" }) }),
    ],
    [
      "in another game",
      () => (mocks.otherGameMods = { other: mod("other", { archiveId: "dl-skyui" }) }),
    ],
  ])("keeps an archive another mod %s is still installed from", async (_, keepOther) => {
    keepOther();

    await deleteModFiles(api, gameId, [installedFile], { deleteArchives: true });

    expect(deletedDownloads()).toEqual([]);
  });

  it("keeps a download another mod is installed from, though it was ticked", async () => {
    mocks.modsAfter = { renamed: mod("renamed", { archiveId: "dl-patch" }) };

    await deleteModFiles(api, gameId, [downloadedFile], { deleteArchives: true });

    expect(deletedDownloads()).toEqual([]);
  });

  it("reports a download it couldn't delete", async () => {
    const error = new Error("locked");
    emit.mockImplementation((_event, _id, callback) => callback?.(error));

    await deleteModFiles(api, gameId, [downloadedFile], { deleteArchives: true });

    expect(api.showErrorNotification).toHaveBeenCalledWith(expect.any(String), error);
  });

  it("deletes nothing when uninstalling is cancelled or fails", async () => {
    mocks.uninstallMods.mockResolvedValue(false);

    await deleteModFiles(api, gameId, [installedFile, downloadedFile], { deleteArchives: true });

    expect(deletedDownloads()).toEqual([]);
  });

  it("deletes an archive once when two files were installed from it", async () => {
    const variant: OwnedModFile = { ...installedFile, modId: "skyui-variant" };

    await deleteModFiles(api, gameId, [installedFile, variant], { deleteArchives: true });

    expect(deletedDownloads()).toEqual(["dl-skyui"]);
  });

  it("doesn't delete a download Vortex no longer has", async () => {
    await deleteModFiles(api, gameId, [{ ...installedFile, hasDownload: false }], {
      deleteArchives: true,
    });

    expect(mocks.uninstallMods).toHaveBeenCalledWith(api, gameId, ["skyui"]);
    expect(deletedDownloads()).toEqual([]);
  });
});

describe("isUninstallingIn", () => {
  const ref = { domain: NexusGameDomain("skyrimspecialedition"), modId: 1 };
  const uninstalling = (modIds: string[]) =>
    ({ session: { base: { activity: { "mods-uninstalling": modIds } } } }) as unknown as IState;

  it("says a mod is uninstalling while any of its installed mods is", () => {
    expect(isUninstallingIn(uninstalling(["skyui-lite"]), ref)).toBe(true);
  });

  it("ignores other mods uninstalling", () => {
    expect(isUninstallingIn(uninstalling(["other"]), ref)).toBe(false);
  });
});

describe("removalCounts", () => {
  const missing: OwnedModFile = { ...installedFile, modId: "gone", hasDownload: false };
  const shared: OwnedModFile = { ...installedFile, modId: "a", otherArchiveUsers: ["b"] };

  it("counts files with a download to keep as uninstalled, and the rest as deleted", () => {
    expect(removalCounts([installedFile, missing], false)).toEqual({ deleted: 1, uninstalled: 1 });
  });

  it("counts every file as deleted when downloads go too", () => {
    expect(removalCounts([installedFile, downloadedFile], true)).toEqual({
      deleted: 2,
      uninstalled: 0,
    });
  });

  it("counts a file whose download another mod not chosen uses as uninstalled", () => {
    expect(removalCounts([shared], true)).toEqual({ deleted: 0, uninstalled: 1 });
    expect(removalCounts([shared, { ...installedFile, modId: "b" }], true)).toEqual({
      deleted: 2,
      uninstalled: 0,
    });
  });
});
