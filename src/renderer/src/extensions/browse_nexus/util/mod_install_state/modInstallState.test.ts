import { GameDomain, VortexGameId } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import type { IDownload } from "@/extensions/download_management/types/IDownload";
import type { IMod } from "@/extensions/mod_management/types/IMod";
import type { IProfileMod } from "@/extensions/profile_management/types/IProfile";

import { downloadKeysOf, groupedModInstallState, groupModInstallSources } from "./modInstallGroups";
import { type IModInstallSources, modInstallState } from "./modInstallState";

const GAME = VortexGameId("enderalspecialedition");
const DOMAIN = GameDomain("enderalspecialedition");
const SKYRIM = GameDomain("skyrimspecialedition");
const SKYUI = 3863;

/** An installed SkyUI, downloaded for Enderal SE, with the update check's attributes. */
const mod = (id: string, attributes: Record<string, unknown> = {}, type = ""): IMod =>
  ({
    id,
    type,
    state: "installed",
    installationPath: id,
    attributes: { source: "nexus", modId: SKYUI, downloadGame: GAME, ...attributes },
  }) as IMod;

/** A mod being installed, as the installer first adds it: no Nexus ids, only its archive. */
const installing = (id: string, archiveId: string): IMod =>
  ({ id, type: "", state: "installing", archiveId, attributes: { name: id } }) as IMod;

/** A finished download of SkyUI for Enderal SE. */
const download = (overrides: Partial<IDownload> = {}): IDownload =>
  ({
    state: "finished",
    game: [GAME],
    modInfo: { nexus: { ids: { gameId: DOMAIN, modId: SKYUI } } },
    ...overrides,
  }) as IDownload;

/** What the user has of SkyUI, which the mod's own grouped sources must agree with. */
const stateOf = (
  mods: Record<string, IMod> = {},
  downloads: Record<string, IDownload> = {},
  modState: Record<string, IProfileMod> = {},
  fileId?: number,
) => {
  const sources: IModInstallSources = {
    mods,
    modState,
    downloads,
    gameId: GAME,
    domainOf: (id) => GameDomain(id === "skyrimse" ? "skyrimspecialedition" : id),
  };

  const ref = { domain: DOMAIN, modId: SKYUI, fileId };
  const state = modInstallState(sources, ref);

  const keys = downloadKeysOf(downloads, sources.domainOf);
  const groups = groupModInstallSources(mods, keys, GAME, sources.domainOf);

  expect(groupedModInstallState(groups, sources, ref)).toEqual(state);
  return state;
};

describe("modInstallState", () => {
  it("is installed, without an update while it's current", () => {
    const skyui = mod("skyui", { fileId: 1, newestFileId: 1 });

    expect(stateOf({ skyui })).toEqual({ kind: "installed", mod: skyui, installedCount: 1 });
  });

  it("offers the update the update check found", () => {
    const skyui = mod("skyui", { fileId: 1, newestFileId: 2 });

    expect(stateOf({ skyui })).toEqual({
      kind: "installed",
      mod: skyui,
      update: "update",
      installedCount: 1,
    });
  });

  it("offers a pick on the site when the newest file isn't known", () => {
    const skyui = mod("skyui", { fileId: 1, newestFileId: "unknown" });

    expect(stateOf({ skyui })).toEqual({
      kind: "installed",
      mod: skyui,
      update: "update-site",
      installedCount: 1,
    });
  });

  it("goes by the version of a file the Mods page shows, the enabled one", () => {
    const old = mod("old", { fileId: 1, logicalFileName: "SkyUI", newestFileId: 2 });
    const current = mod("current", { fileId: 2, logicalFileName: "SkyUI", newestFileId: 2 });

    expect(stateOf({ old, current }, {}, { current: { enabled: true, enabledTime: 1 } })).toEqual({
      kind: "installed",
      mod: current,
      installedCount: 1,
    });
  });

  it("offers the update of any file whose shown version has one", () => {
    const main = mod("main", { fileId: 1, logicalFileName: "Main", newestFileId: 1 });
    const patch = mod("patch", { fileId: 3, logicalFileName: "Patch", newestFileId: 4 });

    expect(stateOf({ main, patch })).toEqual({
      kind: "installed",
      mod: patch,
      update: "update",
      installedCount: 2,
    });
  });

  it("is installing while a download of it is being installed", () => {
    expect(stateOf({ new: installing("new", "dl") }, { dl: download() })).toEqual({
      kind: "installing",
    });
  });

  it("is installing from a download whose domain its lookup hasn't found yet", () => {
    const fresh = download({ modInfo: { nexus: { ids: { modId: SKYUI } } } });

    expect(stateOf({ new: installing("new", "dl") }, { dl: fresh })).toEqual({
      kind: "installing",
    });
  });

  it("isn't installing for another mod's install", () => {
    const other = download({ modInfo: { nexus: { ids: { gameId: DOMAIN, modId: 1 } } } });

    expect(stateOf({ new: installing("new", "dl") }, { dl: other })).toEqual({ kind: "none" });
  });

  it("is installed over downloaded", () => {
    const skyui = mod("skyui");

    expect(stateOf({ skyui }, { dl: download() })).toEqual({
      kind: "installed",
      mod: skyui,
      installedCount: 1,
    });
  });

  it("ignores other mods, collections, and mods from elsewhere", () => {
    const mods = {
      other: mod("other", { modId: 1 }),
      collection: mod("collection", {}, "collection"),
      local: mod("local", { source: undefined }),
    };

    expect(stateOf(mods)).toEqual({ kind: "none" });
  });

  it("ignores the same id from another game's domain", () => {
    const skyrimMod = mod("skyrim", { downloadGame: "skyrimse" });
    const skyrimDownload = download({
      modInfo: { nexus: { ids: { gameId: SKYRIM, modId: SKYUI } } },
    });

    expect(stateOf({ skyrimMod }, { dl: skyrimDownload })).toEqual({ kind: "none" });
  });

  it("is downloaded when only a finished download of it is in this game", () => {
    expect(stateOf({}, { dl: download() })).toEqual({
      kind: "downloaded",
      downloadId: "dl",
      downloadCount: 1,
    });
  });

  it("is downloaded before the lookup finds the download's domain, by its game's", () => {
    const fresh = download({ modInfo: { nexus: { ids: { modId: SKYUI } } } });

    expect(stateOf({}, { dl: fresh })).toEqual({
      kind: "downloaded",
      downloadId: "dl",
      downloadCount: 1,
    });
  });

  it("goes by the download's own domain over its game's", () => {
    const skyrim = download({ modInfo: { nexus: { ids: { gameId: SKYRIM, modId: SKYUI } } } });

    expect(stateOf({}, { dl: skyrim })).toEqual({ kind: "none" });
  });

  it("ignores unfinished downloads and other games'", () => {
    const downloads = {
      started: download({ state: "started" }),
      elsewhere: download({ game: ["fallout4"] }),
    };

    expect(stateOf({}, downloads)).toEqual({ kind: "none" });
  });
});

describe("modInstallState for one file", () => {
  const file = (fileId: number) =>
    download({ modInfo: { nexus: { ids: { gameId: DOMAIN, modId: SKYUI, fileId } } } });
  const downloads = { one: file(1), two: file(2) };
  const two = mod("two", { fileId: 2 });

  it("is downloaded for a file that's only downloaded", () => {
    expect(stateOf({ two }, downloads, {}, 1)).toEqual({
      kind: "downloaded",
      downloadId: "one",
      downloadCount: 1,
    });
  });

  it("counts only the file's own downloads", () => {
    expect(stateOf({}, downloads)).toEqual({
      kind: "downloaded",
      downloadId: "one",
      downloadCount: 2,
    });
    expect(stateOf({}, downloads, {}, 2)).toEqual({
      kind: "downloaded",
      downloadId: "two",
      downloadCount: 1,
    });
  });

  it("counts only the file's own installed versions", () => {
    const one = mod("one", { fileId: 1 });

    expect(stateOf({ one, two })).toMatchObject({ kind: "installed", installedCount: 2 });
    expect(stateOf({ one, two }, {}, {}, 2)).toEqual({
      kind: "installed",
      mod: two,
      installedCount: 1,
    });
  });

  it("is installed for the file that's installed", () => {
    expect(stateOf({ two }, downloads, {}, 2)).toEqual({
      kind: "installed",
      mod: two,
      installedCount: 1,
    });
  });

  it("is installed for the mod without a file", () => {
    expect(stateOf({ two }, downloads)).toEqual({ kind: "installed", mod: two, installedCount: 1 });
  });

  it("is installed by a file id kept as a string", () => {
    const text = mod("text", { fileId: "2" });

    expect(stateOf({ text }, {}, {}, 2)).toEqual({
      kind: "installed",
      mod: text,
      installedCount: 1,
    });
  });

  it("marks neither file for a mod installed from another", () => {
    const three = mod("three", { fileId: 3 });

    expect(stateOf({ three }, downloads, {}, 1)).toEqual({
      kind: "downloaded",
      downloadId: "one",
      downloadCount: 1,
    });
    expect(stateOf({ three }, {}, {}, 2)).toEqual({ kind: "none" });
  });

  it("is installing only for the file being installed", () => {
    const sources = { dl: file(1) };

    expect(stateOf({ new: installing("new", "dl") }, sources, {}, 1)).toEqual({
      kind: "installing",
    });
    expect(stateOf({ new: installing("new", "dl") }, sources, {}, 2)).toEqual({ kind: "none" });
  });
});

describe("modInstallState with a malformed download", () => {
  it("passes over a download that has Nexus ids but no game", () => {
    const gameless = download({ game: undefined, modInfo: { nexus: { ids: { modId: SKYUI } } } });

    expect(stateOf({}, { dl: gameless })).toEqual({ kind: "none" });
  });
});
