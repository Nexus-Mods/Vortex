import { describe, expect, it } from "vitest";

import { makeDownload, makeGameStored } from "@/test-utils/builders";

import NXMUrl, {
  buildNXMCollectionUrl,
  buildNXMModUrl,
  NXMType,
  nxmModUrl,
  nxmUrlFromDownload,
} from "./NXMUrl";

describe("NXMUrl", () => {
  describe("mod file links", () => {
    it("parses the game, mod and file", () => {
      const url = new NXMUrl("nxm://Fallout4/mods/123/files/456");
      expect(url.type).toBe("mod");
      expect(url.gameId).toBe("Fallout4");
      expect(url.modId).toBe(123);
      expect(url.fileId).toBe(456);
    });

    it("exposes mod identifiers for the download pipeline", () => {
      expect(new NXMUrl("nxm://Fallout4/mods/123/files/456").identifiers).toEqual({
        type: NXMType.Mod,
        gameId: "Fallout4",
        modId: 123,
        fileId: 456,
      });
    });

    it("parses the authorisation a site-generated link carries", () => {
      const url = new NXMUrl("nxm://Fallout4/mods/1/files/2?key=abc&expires=1700000000&user_id=42");
      expect(url.key).toBe("abc");
      expect(url.expires).toBe(1700000000);
      expect(url.userId).toBe(42);
    });

    it("leaves the authorisation undefined on a link Vortex built itself", () => {
      const url = new NXMUrl("nxm://Fallout4/mods/1/files/2");
      expect(url.key).toBeUndefined();
      expect(url.expires).toBeUndefined();
      expect(url.userId).toBeUndefined();
    });

    it("reads the view flag in either of its spellings", () => {
      expect(new NXMUrl("nxm://Fallout4/mods/1/files/2?view=true").view).toBe(true);
      expect(new NXMUrl("nxm://Fallout4/mods/1/files/2?view=1").view).toBe(true);
      expect(new NXMUrl("nxm://Fallout4/mods/1/files/2").view).toBe(false);
    });

    it("keeps any other query parameter reachable", () => {
      const url = new NXMUrl("nxm://Fallout4/mods/1/files/2?campaign=health_check");
      expect(url.getParam("campaign")).toBe("health_check");
      expect(url.getParam("absent")).toBeUndefined();
    });
  });

  describe("collection links", () => {
    it("parses a slug and revision number", () => {
      const url = new NXMUrl("nxm://skyrimspecialedition/collections/abcdef/revisions/3");
      expect(url.type).toBe("collection");
      expect(url.collectionSlug).toBe("abcdef");
      expect(url.revisionNumber).toBe(3);
      expect(url.collectionId).toBeUndefined();
    });

    it("marks a latest-revision link with -1", () => {
      const url = new NXMUrl("nxm://skyrimspecialedition/collections/abcdef/revisions/latest");
      expect(url.revisionNumber).toBe(-1);
    });

    it("still parses the legacy numeric collection form", () => {
      const url = new NXMUrl("nxm://skyrimspecialedition/collections/12345/revisions/678");
      expect(url.collectionId).toBe(12345);
      expect(url.revisionId).toBe(678);
      expect(url.collectionSlug).toBeUndefined();
    });

    it("exposes collection identifiers for the download pipeline", () => {
      const url = new NXMUrl("nxm://skyrimspecialedition/collections/abcdef/revisions/3");
      expect(url.identifiers).toEqual({
        type: NXMType.Collection,
        gameId: "skyrimspecialedition",
        collectionId: undefined,
        revisionId: undefined,
        collectionSlug: "abcdef",
        revisionNumber: 3,
      });
    });
  });

  describe("non-download links", () => {
    it("parses an oauth callback", () => {
      const url = new NXMUrl("nxm://oauth/callback?code=the-code&state=the-state");
      expect(url.type).toBe("oauth");
      expect(url.oauthCode).toBe("the-code");
      expect(url.oauthState).toBe("the-state");
      expect(url.identifiers).toBeNull();
    });

    it("parses the membership-changed link", () => {
      expect(new NXMUrl("nxm://premium").type).toBe("premium");
    });
  });

  describe("rejected input", () => {
    it.each([
      ["not a url at all", "gugu"],
      ["another protocol", "https://www.nexusmods.com/skyrimspecialedition/mods/1"],
      ["an nxm url with no recognised path", "nxm://Fallout4/something/else"],
    ])("throws on %s", (_label, input) => {
      expect(() => new NXMUrl(input)).toThrow("invalid nxm url");
    });
  });

  describe("building links", () => {
    it("builds a mod file link from a resolved domain", () => {
      expect(buildNXMModUrl("skyrimspecialedition", 100, 500)).toBe(
        "nxm://skyrimspecialedition/mods/100/files/500",
      );
    });

    it("builds a collection link from a resolved domain", () => {
      expect(buildNXMCollectionUrl("skyrimspecialedition", "abcdef", 3)).toBe(
        "nxm://skyrimspecialedition/collections/abcdef/revisions/3",
      );
    });

    it("resolves the game's nxm link id when building from a game", () => {
      const game = makeGameStored({ id: "skyrimse", details: { nxmLinkId: "SkyrimSE" } });
      expect(nxmModUrl(game, "skyrimse", 100, 500)).toBe("nxm://SkyrimSE/mods/100/files/500");
    });
  });

  describe("rebuilding the link for a stored download", () => {
    it("rebuilds a mod download from its nexus ids", () => {
      const download = makeDownload({
        modInfo: { nexus: { ids: { gameId: "skyrimspecialedition", modId: 100, fileId: 500 } } },
      });
      expect(nxmUrlFromDownload(download)).toBe("nxm://skyrimspecialedition/mods/100/files/500");
    });

    it("rebuilds a collection download from its slug and revision", () => {
      const download = makeDownload({
        modInfo: {
          nexus: {
            ids: { gameId: "skyrimspecialedition", collectionSlug: "abcdef", revisionNumber: 3 },
          },
        },
      });
      expect(nxmUrlFromDownload(download)).toBe(
        "nxm://skyrimspecialedition/collections/abcdef/revisions/3",
      );
    });

    it("falls back to the meta domain when the nexus game id is missing", () => {
      const download = makeDownload({
        modInfo: {
          nexus: { ids: { modId: 100, fileId: 500 } },
          meta: { gameId: "1704", domainName: "skyrimspecialedition" },
        },
      });
      expect(nxmUrlFromDownload(download)).toBe("nxm://skyrimspecialedition/mods/100/files/500");
    });

    it.each([
      ["there is no nexus identity at all", makeDownload()],
      [
        "a mod download is missing its file id",
        makeDownload({ modInfo: { nexus: { ids: { gameId: "skyrimspecialedition", modId: 1 } } } }),
      ],
      [
        "a collection download is missing its revision",
        makeDownload({
          modInfo: { nexus: { ids: { gameId: "skyrimspecialedition", collectionSlug: "abc" } } },
        }),
      ],
    ])("returns nothing when %s", (_label, download) => {
      expect(nxmUrlFromDownload(download)).toBeUndefined();
    });
  });
});
