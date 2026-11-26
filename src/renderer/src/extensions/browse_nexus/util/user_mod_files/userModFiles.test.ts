import { NexusGameDomain, VortexGameId } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import type { IDownload } from "@/extensions/download_management/types/IDownload";
import type { IMod } from "@/extensions/mod_management/types/IMod";

import { storedNameOf, userModFilesOf } from "./userModFiles";

const GAME = VortexGameId("skyrimse");
const DOMAIN = NexusGameDomain("skyrimspecialedition");
const KEY = "skyrimspecialedition/1";

/** A mod installed from Nexus Mods mod 1, or another, from a download. */
const mod = (id: string, overrides: Partial<IMod> = {}, modId = 1): IMod =>
  ({
    id,
    type: "",
    state: "installed",
    installationPath: id,
    attributes: { source: "nexus", modId, downloadGame: GAME },
    ...overrides,
  }) as IMod;

/** A finished download of a file of Nexus Mods mod 1, or another. */
const download = (overrides: Partial<IDownload> = {}, modId = 1): IDownload =>
  ({
    state: "finished",
    game: [GAME],
    modInfo: { nexus: { ids: { gameId: DOMAIN, modId } } },
    ...overrides,
  }) as unknown as IDownload;

const filesOf = (mods: Record<string, IMod>, downloads: Record<string, IDownload>) =>
  userModFilesOf({ mods, downloads, gameId: GAME, domainOf: () => DOMAIN }, KEY).map((file) =>
    file.kind === "installed" ? `mod:${file.mod.id}` : `download:${file.downloadId}`,
  );

describe("userModFilesOf", () => {
  it("lists the mod's installed mods, then its downloads nothing is installed from", () => {
    expect(
      filesOf(
        { skyui: mod("skyui", { archiveId: "dl-skyui" }) },
        { "dl-skyui": download(), "dl-patch": download() },
      ),
    ).toEqual(["mod:skyui", "download:dl-patch"]);
  });

  it("leaves out other mods' files, collections, unfinished downloads and other games'", () => {
    expect(
      filesOf(
        { other: mod("other", {}, 2), collection: mod("collection", { type: "collection" }) },
        {
          other: download({}, 2),
          running: download({ state: "started" }),
          elsewhere: download({ game: ["fallout4"] }),
        },
      ),
    ).toEqual([]);
  });

  it("leaves out a mod still installing, and the download it's installing from", () => {
    expect(
      filesOf({ busy: mod("busy", { state: "installing", archiveId: "dl" }) }, { dl: download() }),
    ).toEqual([]);
  });

  it("leaves out a download installed as a mod that isn't this one by its own ids", () => {
    expect(
      filesOf(
        { renamed: mod("renamed", { archiveId: "dl", attributes: { source: "user" } }) },
        { dl: download() },
      ),
    ).toEqual([]);
  });
});

describe("storedNameOf", () => {
  it("names an installed file as the Mods page does", () => {
    const named = mod("skyui", { attributes: { logicalFileName: "SkyUI Main" } });

    expect(storedNameOf({ kind: "installed", mod: named })).toBe("SkyUI Main");
  });

  it("names a download by its file, falling back to its id when nothing was stored", () => {
    const stored = download({
      modInfo: { nexus: { fileInfo: { name: "SkyUI Patch" } } },
    } as Partial<IDownload>);

    expect(storedNameOf({ kind: "downloaded", downloadId: "dl", download: stored })).toBe(
      "SkyUI Patch",
    );
    expect(
      storedNameOf({ kind: "downloaded", downloadId: "dl", download: download({ modInfo: {} }) }),
    ).toBe("dl");
  });
});
