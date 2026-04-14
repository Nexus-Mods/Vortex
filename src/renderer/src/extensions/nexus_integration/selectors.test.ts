import { describe, expect, it, vi } from "vitest";

import type { IState } from "../../types/IState";

// `nexusIdsFromDownloadId` calls into `nexusGames()` from ./util to look up
// the numeric game id by domain name. We stub it with a fixed list so the
// selector is deterministic in tests.
vi.mock("./util", () => ({
  nexusGames: () => [{ id: 3174, domain_name: "mountandblade2bannerlord" }],
}));

import { nexusIdsFromDownloadId } from "./selectors";

/**
 * Build a minimal IState that only populates `persistent.downloads.files` —
 * everything else is left as `undefined` and cast so the selector type-checks.
 * The selector only reads `state.persistent.downloads.files`, so this is safe.
 */
function makeState(downloads: Record<string, { modInfo?: any }>): IState {
  return {
    persistent: {
      downloads: { files: downloads },
    },
  } as unknown as IState;
}

describe("nexusIdsFromDownloadId", () => {
  describe("collection downloads (APP-277 regression)", () => {
    // The modInfo shape produced by `handleAddCollection` in BrowseNexusPage
    // and `installCollection` in the collections extension after the APP-277
    // fix. If either handler regresses to passing `{}`, this selector returns
    // `undefined` and the `collections_download_completed` analytics event
    // never fires.
    const collectionModInfo = {
      game: "mountandblade2bannerlord",
      source: "nexus",
      name: "Best Mods",
      nexus: {
        ids: {
          gameId: "mountandblade2bannerlord",
          collectionId: 381270,
          revisionId: 731428176,
          collectionSlug: "pjkqjk",
          revisionNumber: 18,
        },
      },
    };

    it("identifies a collection download and returns the collection ids", () => {
      const state = makeState({
        dl1: { modInfo: collectionModInfo },
      });

      const result = nexusIdsFromDownloadId(state, "dl1");

      expect(result).toBeDefined();
      expect(result!.collectionSlug).toBe("pjkqjk");
      expect(result!.revisionId).toBe("731428176");
      expect(result!.collectionId).toBe("381270");
      expect(result!.numericGameId).toBe(3174);
    });

    it("classifies the download as a collection (collectionSlug + revisionId both set)", () => {
      // This mirrors DownloadObserver's `isCollection` check — if either field
      // is undefined, the analytics block falls into the mod or "not a Nexus
      // mod" branch and the collection event is never emitted.
      const state = makeState({
        dl1: { modInfo: collectionModInfo },
      });

      const result = nexusIdsFromDownloadId(state, "dl1");
      const isCollection =
        result?.collectionSlug !== undefined &&
        result?.revisionId !== undefined;

      expect(isCollection).toBe(true);
    });

    it("returns undefined for an empty modInfo (the pre-fix bug)", () => {
      // Before APP-277 was fixed, `BrowseNexusPage.handleAddCollection` and
      // `installCollection` emitted `start-download` with `modInfo: {}`,
      // which resulted in the persisted download having no `nexus.ids`. The
      // selector bails out early in that case, which caused the analytics
      // block in DownloadObserver to misclassify the download as non-Nexus.
      const state = makeState({
        dl1: { modInfo: {} },
      });

      const result = nexusIdsFromDownloadId(state, "dl1");

      expect(result).toBeUndefined();
    });
  });

  describe("mod downloads", () => {
    it("returns the mod ids for a download populated by startDownloadMod", () => {
      const state = makeState({
        dl1: {
          modInfo: {
            game: "mountandblade2bannerlord",
            source: "nexus",
            nexus: {
              ids: {
                gameId: "mountandblade2bannerlord",
                modId: 5295,
                fileId: 38908,
              },
            },
          },
        },
      });

      const result = nexusIdsFromDownloadId(state, "dl1");

      expect(result).toBeDefined();
      expect(result!.modId).toBe("5295");
      expect(result!.fileId).toBe("38908");
      expect(result!.collectionSlug).toBeUndefined();
      expect(result!.revisionId).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("returns undefined when the download entry is missing", () => {
      const state = makeState({});
      expect(nexusIdsFromDownloadId(state, "nope")).toBeUndefined();
    });

    it("returns undefined when modInfo has neither nexus.ids.gameId nor meta.gameId", () => {
      const state = makeState({
        dl1: { modInfo: { source: "unknown" } },
      });
      expect(nexusIdsFromDownloadId(state, "dl1")).toBeUndefined();
    });
  });
});
