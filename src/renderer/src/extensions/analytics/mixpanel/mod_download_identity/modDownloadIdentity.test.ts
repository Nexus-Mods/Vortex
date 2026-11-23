import { describe, expect, it } from "vitest";

import { makeModDownloadIdentity } from "./modDownloadIdentity";

const nexusIds = { numericGameId: 1704, modId: "3863", fileId: "1000172397" };

/** The identity of a plain download of SkyUI's file: no collection, no source. */
const PLAIN = {
  mod_id: "3863",
  file_id: "1000172397",
  game_id: 1704,
  mod_uid: "7318624276247",
  file_uid: "7319624444781",
  collection_id: null,
  revision_id: null,
  download_source: null,
};

describe("makeModDownloadIdentity", () => {
  it("is the mod's identity, with no collection or source for a plain download", () => {
    expect(makeModDownloadIdentity({ nexusIds, download: { modInfo: {} } })).toEqual(PLAIN);
  });

  it("carries the collection the download was part of", () => {
    const download = { modInfo: { nexus: { parentCollectionId: "17", parentRevisionId: "42" } } };

    expect(makeModDownloadIdentity({ nexusIds, download })).toEqual({
      ...PLAIN,
      collection_id: "17",
      revision_id: "42",
    });
  });

  it("carries where the download started", () => {
    const download = { modInfo: { downloadSource: "browse_website" as const } };

    expect(makeModDownloadIdentity({ nexusIds, download })).toEqual({
      ...PLAIN,
      download_source: "browse_website",
    });
  });

  it("has no collection or source for a download Vortex has no record of", () => {
    expect(makeModDownloadIdentity({ nexusIds, download: undefined })).toEqual(PLAIN);
  });
});
