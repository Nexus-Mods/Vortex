import { describe, expect, test } from "vitest";

import type { IDownload } from "@/extensions/download_management/types/IDownload";
import type { IModDetails } from "@/extensions/health_check/types";
import { makeModUID } from "@/extensions/nexus_integration/util/UIDs";
import type { IExtensionApi } from "@/types/IExtensionContext";

import {
  makeDownloadedFileHydrator,
  makeInstalledFileHydrator,
  type IDownloadedFileRef,
  type IInstalledFileRef,
} from "./installedFiles";

const REF: IDownloadedFileRef = { fileUID: "file-1", modUID: "mod-1", downloadId: "dl-1" };

const DETAILS: IModDetails = {
  modUID: "mod-1",
  modName: "Details Name",
  modSummary: "details summary",
  thumbnailUrl: "http://img/details.png",
  adultContent: true,
};

/** An api whose downloads store holds the given downloads keyed by id. */
function apiWith(files: { [id: string]: Partial<IDownload> }): IExtensionApi {
  return {
    getState: () => ({ persistent: { downloads: { files } } }),
  } as unknown as IExtensionApi;
}

/** A download carrying the given modInfo block, plus any extra download fields. */
function download(modInfo: unknown, over: Partial<IDownload> = {}): Partial<IDownload> {
  return { game: ["skyrimse"], modInfo, ...over };
}

/** Hydrate the single REF from a download and (optionally) its mod details. */
function hydrate(dl: Partial<IDownload> | undefined, details?: IModDetails) {
  const files = dl ? { "dl-1": dl } : {};
  const map = details ? new Map([[details.modUID, details]]) : new Map<string, IModDetails>();
  return makeDownloadedFileHydrator(apiWith(files), [REF], map)("file-1");
}

describe("makeDownloadedFileHydrator", () => {
  test("returns undefined for a fileUID with no ref", () => {
    const result = makeDownloadedFileHydrator(
      apiWith({ "dl-1": download({}) }),
      [REF],
      new Map(),
    )("unknown");
    expect(result).toBeUndefined();
  });

  test("returns undefined when the download is gone from state", () => {
    expect(hydrate(undefined)).toBeUndefined();
  });

  test("carries the ref identifiers straight through", () => {
    expect(hydrate(download({ nexus: { ids: {} } }))).toMatchObject({
      downloadId: "dl-1",
      fileUID: "file-1",
      modUID: "mod-1",
    });
  });

  describe("thumbnail / summary / adult flag", () => {
    test("prefers the download's own summary and thumbnail over mod details", () => {
      const dl = download({
        nexus: {
          modInfo: {
            summary: "own summary",
            picture_url: "http://img/own.png",
            contains_adult_content: true,
          },
        },
      });
      expect(hydrate(dl, DETAILS)).toMatchObject({
        modSummary: "own summary",
        thumbnailUrl: "http://img/own.png",
        adultContent: true,
      });
    });

    test("backfills from mod details when the download carries only nexus.ids", () => {
      const dl = download({ nexus: { ids: { modId: 1, fileId: 2 } } });
      expect(hydrate(dl, DETAILS)).toMatchObject({
        modSummary: "details summary",
        thumbnailUrl: "http://img/details.png",
        adultContent: true,
      });
    });

    test("takes the fetched adult flag over the download's own (LAZ-849)", () => {
      const dl = download({ nexus: { modInfo: { contains_adult_content: false } } });
      expect(hydrate(dl, DETAILS)?.adultContent).toBe(true);
    });

    test("keeps the download's adult flag when no details were fetched (guards ?? vs ||)", () => {
      const dl = download({ nexus: { modInfo: { contains_adult_content: true } } });
      expect(hydrate(dl)?.adultContent).toBe(true);
      expect(
        hydrate(download({ nexus: { modInfo: { contains_adult_content: false } } }))?.adultContent,
      ).toBe(false);
    });

    test("leaves summary/thumbnail undefined and adult false when neither source supplies them", () => {
      expect(hydrate(download({ nexus: { ids: {} } }))).toMatchObject({
        modSummary: undefined,
        thumbnailUrl: undefined,
        adultContent: false,
      });
    });
  });

  describe("modName fallback chain", () => {
    test("uses the download's own name first", () => {
      const dl = download({ name: "Own Name", nexus: {} }, { localPath: "archive.zip" });
      expect(hydrate(dl, DETAILS)?.modName).toBe("Own Name");
    });

    test("falls back to mod details when the download has no name", () => {
      const dl = download({ nexus: {} }, { localPath: "archive.zip" });
      expect(hydrate(dl, DETAILS)?.modName).toBe("Details Name");
    });

    test("falls back to localPath when neither name nor details apply", () => {
      const dl = download({ nexus: {} }, { localPath: "archive.zip" });
      expect(hydrate(dl)?.modName).toBe("archive.zip");
    });

    test("falls back to the download id as a last resort", () => {
      expect(hydrate(download({ nexus: {} }))?.modName).toBe("dl-1");
    });
  });

  describe("fileName and version", () => {
    test("fileName prefers meta.fileName, then localPath, then modName", () => {
      expect(
        hydrate(download({ meta: { fileName: "file.7z" }, nexus: {} }, { localPath: "lp" }))
          ?.fileName,
      ).toBe("file.7z");
      expect(hydrate(download({ nexus: {} }, { localPath: "lp" }))?.fileName).toBe("lp");
      expect(hydrate(download({ name: "Own Name", nexus: {} }))?.fileName).toBe("Own Name");
    });

    test("version comes from meta.fileVersion and defaults to empty string", () => {
      expect(hydrate(download({ meta: { fileVersion: "3.1" }, nexus: {} }))?.version).toBe("3.1");
      expect(hydrate(download({ nexus: {} }))?.version).toBe("");
    });
  });
});

describe("makeInstalledFileHydrator", () => {
  // Numeric downloadGame so the composite UID resolves without the Nexus games list.
  const INSTALLED_MOD_UID = makeModUID({ gameId: "1704", modId: "42", fileId: "7" });
  const INSTALLED_REF: IInstalledFileRef = {
    fileUID: "file-a",
    modId: "mod-a",
    enabled: true,
    emitRequirements: true,
  };

  /** Hydrate one installed mod whose archive stores `adultInDownload`, if given. */
  function hydrateInstalled(adultInDownload?: boolean, details?: IModDetails) {
    const api = {
      getState: () => ({
        settings: { profiles: { activeProfileId: "p1" } },
        persistent: {
          profiles: { p1: { id: "p1", gameId: "skyrimse" } },
          mods: {
            skyrimse: {
              "mod-a": {
                id: "mod-a",
                state: "installed",
                archiveId: "dl-a",
                attributes: {
                  source: "nexus",
                  modId: 42,
                  fileId: 7,
                  downloadGame: "1704",
                  logicalFileName: "Mod A",
                },
              },
            },
          },
          downloads: {
            files: {
              "dl-a": download(
                adultInDownload === undefined
                  ? { nexus: { ids: {} } }
                  : { nexus: { modInfo: { contains_adult_content: adultInDownload } } },
              ),
            },
          },
        },
      }),
    } as unknown as IExtensionApi;
    const map = details ? new Map([[details.modUID, details]]) : new Map<string, IModDetails>();
    return makeInstalledFileHydrator(api, [INSTALLED_REF], map)("file-a");
  }

  test("takes the fetched adult flag over the originating download's, and its thumbnail", () => {
    const details: IModDetails = { ...DETAILS, modUID: INSTALLED_MOD_UID };
    expect(hydrateInstalled(false, details)).toMatchObject({
      modUID: INSTALLED_MOD_UID,
      adultContent: true,
      // the fixture mod has no pictureUrl attribute of its own
      thumbnailUrl: "http://img/details.png",
    });
  });

  test("falls back to the download's adult flag when no details were fetched", () => {
    expect(hydrateInstalled(true)?.adultContent).toBe(true);
    expect(hydrateInstalled(false)?.adultContent).toBe(false);
    expect(hydrateInstalled()?.adultContent).toBe(false);
  });
});
