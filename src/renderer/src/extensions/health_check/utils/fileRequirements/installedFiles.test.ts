import { describe, expect, test } from "vitest";

import type { IDownload } from "@/extensions/download_management/types/IDownload";
import type { IModDetails } from "@/extensions/health_check/types";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { makeDownloadedFileHydrator, type IDownloadedFileRef } from "./installedFiles";

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
    test("prefers the download's own nexus.modInfo over mod details", () => {
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

    test("keeps contains_adult_content:false over details:true (guards ?? vs ||)", () => {
      const dl = download({ nexus: { modInfo: { contains_adult_content: false } } });
      expect(hydrate(dl, DETAILS)?.adultContent).toBe(false);
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
