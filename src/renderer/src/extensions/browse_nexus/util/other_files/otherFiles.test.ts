import type { IFileInfo } from "@nexusmods/nexus-api";
import { NexusGameDomain, VortexGameId } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import type { IDownload } from "@/extensions/download_management/types/IDownload";
import type { IMod } from "@/extensions/mod_management/types/IMod";

import { otherFilesOf } from "./otherFiles";

const GAME = VortexGameId("skyrimse");
const DOMAIN = NexusGameDomain("skyrimspecialedition");
const MOD_ID = 44329;

/** A file of the mod as the site lists it now. */
const site = (file_id: number, category_name: string, name = `File ${file_id}`) =>
  ({ file_id, category_name, name }) as IFileInfo;

/** An installed file of the mod, as stored when it was installed. */
const installed = (id: string, fileId: number, attributes: Record<string, unknown> = {}) =>
  ({
    id,
    type: "",
    state: "installed",
    installationPath: id,
    attributes: { source: "nexus", modId: MOD_ID, fileId, downloadGame: GAME, ...attributes },
  }) as IMod;

/** A finished download of a file of the mod, with what was stored of it. */
const downloaded = (fileId: number, fileInfo?: Partial<IFileInfo>): IDownload =>
  ({
    state: "finished",
    game: [GAME],
    modInfo: {
      nexus: { ids: { gameId: DOMAIN, modId: MOD_ID, fileId }, fileInfo: fileInfo as IFileInfo },
    },
  }) as unknown as IDownload;

const groupsOf = (
  files: IFileInfo[],
  mods: Record<string, IMod> = {},
  downloads: Record<string, IDownload> = {},
) =>
  otherFilesOf(
    { mods, downloads, gameId: GAME, domainOf: () => DOMAIN },
    { domain: DOMAIN, modId: MOD_ID },
    files,
  );

describe("otherFilesOf", () => {
  it("is nothing when the user has only Main files, or nothing", () => {
    const files = [site(1, "MAIN"), site(2, "OPTIONAL")];

    expect(groupsOf(files)).toEqual([]);
    expect(groupsOf(files, { main: installed("main", 1) }, { dl: downloaded(1) })).toEqual([]);
  });

  it("groups installed and downloaded files by the site's category, in order", () => {
    const files = [
      site(1, "ARCHIVED", "Old"),
      site(2, "OPTIONAL", "Patch"),
      site(3, "OPTIONAL", "Eyes"),
    ];

    expect(
      groupsOf(
        files,
        { patch: installed("patch", 2) },
        { old: downloaded(1), eyes: downloaded(3) },
      ),
    ).toEqual([
      {
        category: "OPTIONAL",
        files: [
          { rowId: "eyes", name: "Eyes" },
          { rowId: "patch", name: "Patch" },
        ],
      },
      { category: "ARCHIVED", files: [{ rowId: "old", name: "Old" }] },
    ]);
  });

  it("goes by the site's category over the one stored", () => {
    const mods = { patch: installed("patch", 2, { fileType: "OPTIONAL" }) };

    expect(groupsOf([site(2, "ARCHIVED", "Patch")], mods)).toEqual([
      { category: "ARCHIVED", files: [{ rowId: "patch", name: "Patch" }] },
    ]);
  });

  it("falls back to the stored category and name for a file gone from the site", () => {
    const mods = {
      patch: installed("patch", 2, { fileType: "OPTIONAL", logicalFileName: "Patch" }),
    };
    const downloads = { misc: downloaded(3, { category_name: "MISCELLANEOUS", name: "Extras" }) };

    expect(groupsOf([], mods, downloads)).toEqual([
      { category: "OPTIONAL", files: [{ rowId: "patch", name: "Patch" }] },
      { category: "MISCELLANEOUS", files: [{ rowId: "misc", name: "Extras" }] },
    ]);
  });

  it("leaves out a file stored as Main that the site no longer lists", () => {
    expect(groupsOf([], { gone: installed("gone", 9, { fileType: "MAIN" }) })).toEqual([]);
  });

  it("lists an installed file once, as its mod, not also its download", () => {
    const mods = { patch: { ...installed("patch", 2), archiveId: "dl" } };

    expect(groupsOf([site(2, "OPTIONAL", "Patch")], mods, { dl: downloaded(2) })).toEqual([
      { category: "OPTIONAL", files: [{ rowId: "patch", name: "Patch" }] },
    ]);
  });

  it("lists repeat downloads of a file once", () => {
    const downloads = { a: downloaded(2), b: downloaded(2) };

    expect(groupsOf([site(2, "OPTIONAL")], {}, downloads)[0].files).toHaveLength(1);
  });

  it("ignores other mods' files, unfinished downloads and other games'", () => {
    const other = {
      ...installed("other", 2),
      attributes: { source: "nexus", modId: 1, fileId: 2 },
    } as IMod;
    const downloads = {
      running: { ...downloaded(2), state: "started" } as IDownload,
      elsewhere: { ...downloaded(2), game: [VortexGameId("fallout4")] },
    };

    expect(groupsOf([site(2, "OPTIONAL")], { other }, downloads)).toEqual([]);
  });

  it("ignores a mod still being installed, and the download it's installed from", () => {
    const mods = {
      busy: { ...installed("busy", 2), state: "installing", archiveId: "dl" } as IMod,
    };

    expect(groupsOf([site(2, "OPTIONAL")], mods, { dl: downloaded(2) })).toEqual([]);
  });
});
