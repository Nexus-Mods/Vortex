import { NexusError, RateLimitError } from "@nexusmods/nexus-api";
import PromiseBB from "bluebird";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";

import { makeApiUserInfo, makeGameStored, makeSession } from "@/test-utils/builders";
import type { INxmHarness } from "@/test-utils/harnessTypes";
import type { INxmFixtures } from "@/test-utils/nxmTest";
import { COLLECTION_URL, FREE, MOD_URL, PREMIUM, test } from "@/test-utils/nxmTest";
import { DataInvalid, HTTPError, ProcessCanceled, UserCanceled } from "@/util/CustomErrors";

import { markCollectionMemberSkipped } from "../../util/collectionSkip";
import opn from "../../util/opn";
import { SITE_ID } from "../gamemode_management/constants";
import { refreshMembership } from "./membership";
import type * as nexusUtil from "./util";
import { getInfoGraphQL } from "./util";

// only the network-touching exports are faked; the membership re-check runs the real
// transformUserInfoFromApi over what getUserInfo returns
vi.mock("./util", async (importOriginal) => ({
  ...(await importOriginal<typeof nexusUtil>()),
  bringToFront: vi.fn(),
  ensureLoggedIn: vi.fn(() => PromiseBB.resolve()),
  getInfoGraphQL: vi.fn(),
  oauthCallback: vi.fn(),
  startDownload: vi.fn(() => PromiseBB.resolve("dl-1")),
}));

vi.mock("../../util/opn", () => ({ default: vi.fn(() => PromiseBB.resolve()) }));

vi.mock("../../util/collectionSkip", () => ({ markCollectionMemberSkipped: vi.fn() }));

const modInfoQuery = vi.mocked(getInfoGraphQL);
const openPage = vi.mocked(opn);
const markSkipped = vi.mocked(markCollectionMemberSkipped);

/** A resolved download link, in the shape the v1 API returns. */
const downloadLink = (uri: string) => [{ URI: uri, short_name: "cdn", name: "CDN" }];

/** A second file, for the cases that need more than one download parked at once. */
const OTHER_MOD_URL = "nxm://skyrimspecialedition/mods/200/files/600";

/** A mod the author has NOT opted into direct downloads, so a free user needs the website. */
const websiteRoundTrip = () =>
  modInfoQuery.mockResolvedValue({
    modInfo: { direct_download_enabled: false },
    fileInfo: {},
  } as never);

/** An API refusal, as nexus-api raises it before the handler maps it to an HTTPError. */
const apiError = (statusCode: number, message: string) =>
  new NexusError(message, statusCode, "https://api/download_link", message);

describe("nxm protocol resolver", () => {
  beforeEach(() => {
    modInfoQuery.mockReset();
  });

  test("rejects a url that isn't an nxm link", async ({ makeNxm }) => {
    const { resolve } = makeNxm();
    await expect(resolve("not-a-url")).rejects.toBeInstanceOf(DataInvalid);
  });

  test("rejects a link generated for a different account, without offering a report", async ({
    makeNxm,
  }) => {
    const { harness, resolve } = makeNxm();

    await expect(resolve(`${MOD_URL}?user_id=99`)).rejects.toBeInstanceOf(ProcessCanceled);
    expect(harness.errorNotifications).toEqual([
      expect.objectContaining({ title: "Invalid download links", allowReport: false }),
    ]);
  });

  test("rejects an nxm url that isn't a download link", async ({ makeNxm }) => {
    const { resolve } = makeNxm();
    await expect(resolve("nxm://premium")).rejects.toThrow("Not a download url");
  });

  describe("premium account", () => {
    test("resolves a mod file to its download urls and nexus ids", async ({ makeNxm }) => {
      const { harness, resolve } = makeNxm();
      harness.getDownloadURLs.mockResolvedValue(downloadLink("https://cdn/file.7z"));

      await expect(resolve(MOD_URL)).resolves.toEqual({
        urls: ["https://cdn/file.7z"],
        updatedUrl: MOD_URL,
        meta: expect.objectContaining({
          source: "nexus",
          nexus: { ids: { modId: 100, fileId: 500 } },
        }),
      });
      // the nxm domain is mapped to the game's nexus page id before the request
      expect(harness.getDownloadURLs).toHaveBeenCalledWith(
        100,
        500,
        undefined,
        undefined,
        "skyrimspecialedition",
      );
    });

    test("forwards the key and expiry of a site-generated link", async ({ makeNxm }) => {
      const { harness, resolve } = makeNxm();
      harness.getDownloadURLs.mockResolvedValue(downloadLink("https://cdn/file.7z"));

      await resolve(`${MOD_URL}?key=abc&expires=1700000000`);

      expect(harness.getDownloadURLs).toHaveBeenCalledWith(
        100,
        500,
        "abc",
        1700000000,
        "skyrimspecialedition",
      );
    });

    test("serves a repeated request for the same file from the cache", async ({ makeNxm }) => {
      const { harness, resolve } = makeNxm();
      harness.getDownloadURLs.mockResolvedValue(downloadLink("https://cdn/file.7z"));

      await resolve(MOD_URL);
      await resolve(MOD_URL);

      expect(harness.getDownloadURLs).toHaveBeenCalledTimes(1);
    });

    test("resolves a collection revision through its download link", async ({ makeNxm }) => {
      const { harness, resolve } = makeNxm();
      harness.getCollectionRevisionGraph.mockResolvedValue({
        id: 42,
        downloadLink: "https://api/revisions/42/download",
        collection: { id: 11 },
      });
      harness.getCollectionDownloadLink.mockResolvedValue(downloadLink("https://cdn/coll.7z"));

      await expect(resolve(COLLECTION_URL)).resolves.toEqual({
        urls: ["https://cdn/coll.7z"],
        updatedUrl: COLLECTION_URL,
        meta: expect.objectContaining({
          source: "nexus",
          nexus: {
            ids: {
              collectionId: 11,
              revisionId: 42,
              collectionSlug: "abcdef",
              revisionNumber: 3,
            },
          },
        }),
      });
      expect(harness.getCollectionRevisionGraph).toHaveBeenCalledWith(
        expect.anything(),
        "abcdef",
        3,
      );
    });

    test("asks for the latest revision when the url says latest", async ({ makeNxm }) => {
      const { harness, resolve } = makeNxm();
      harness.getCollectionRevisionGraph.mockRejectedValue(new Error("boom"));

      await expect(
        resolve("nxm://skyrimspecialedition/collections/abcdef/revisions/latest"),
      ).rejects.toThrow("boom");
      expect(harness.getCollectionRevisionGraph).toHaveBeenCalledWith(
        expect.anything(),
        "abcdef",
        undefined,
      );
    });

    test("annotates a failed collection lookup with the revision it was for", async ({
      makeNxm,
    }) => {
      const { harness, resolve } = makeNxm();
      harness.getCollectionRevisionGraph.mockRejectedValue(new Error("boom"));

      await expect(resolve(COLLECTION_URL)).rejects.toMatchObject({
        collectionSlug: "abcdef",
        revisionNumber: 3,
      });
    });

    test("still uses the premium path for a site (extension) download", async ({ makeNxm }) => {
      const { harness, resolve } = makeNxm({
        userInfo: FREE,
        knownGames: [makeGameStored({ id: SITE_ID, details: undefined })],
      });
      harness.getDownloadURLs.mockResolvedValue(downloadLink("https://cdn/ext.7z"));

      await resolve(`nxm://${SITE_ID}/mods/100/files/500`);

      expect(harness.getDownloadURLs).toHaveBeenCalled();
      expect(harness.freeUserQueue()).toEqual([]);
    });
  });

  describe("api errors", () => {
    test("turns a nexus api error into an HTTPError carrying the status code", async ({
      makeNxm,
    }) => {
      const { harness, resolve } = makeNxm();
      harness.getDownloadURLs.mockRejectedValue(apiError(500, "server exploded"));

      const err = await resolve(MOD_URL).catch((caught: unknown) => caught);

      expect(err).toBeInstanceOf(HTTPError);
      expect((err as HTTPError).statusCode).toBe(500);
    });

    test("reports a 401 as a log-in problem rather than a raw http error", async ({ makeNxm }) => {
      const { harness, resolve } = makeNxm();
      harness.getDownloadURLs.mockRejectedValue(apiError(401, "unauthorized"));

      await expect(resolve(MOD_URL)).rejects.toThrow("You are not logged in to Nexus Mods!");
    });

    test("shows a non-reportable notification when the api rate limit is hit", async ({
      makeNxm,
    }) => {
      const { harness, resolve } = makeNxm();
      harness.getDownloadURLs.mockRejectedValue(new RateLimitError());

      await expect(resolve(MOD_URL)).rejects.toBeInstanceOf(RateLimitError);
      expect(harness.errorNotifications).toEqual([
        expect.objectContaining({ title: "Rate limit exceeded", allowReport: false }),
      ]);
    });
  });

  describe("free account", () => {
    const queued = (harness: INxmHarness) =>
      vi.waitFor(() => expect(harness.freeUserQueue()).toHaveLength(1));

    test("queues the download for the site round trip", async ({ makeNxm }) => {
      const { harness, nxm, resolve } = makeNxm({ userInfo: FREE });
      websiteRoundTrip();

      const pending = resolve(MOD_URL);
      await queued(harness);

      expect(harness.freeUserQueue()).toEqual([MOD_URL]);
      expect(harness.getDownloadURLs).not.toHaveBeenCalled();

      nxm.dialogHandlers.onCancel(MOD_URL);
      await expect(pending).rejects.toBeInstanceOf(UserCanceled);
    });

    test("downloads a direct-download mod in app instead of queueing it", async ({ makeNxm }) => {
      const { harness, resolve } = makeNxm({ userInfo: FREE });
      modInfoQuery.mockResolvedValue({
        modInfo: { direct_download_enabled: true },
        fileInfo: {},
      } as never);
      harness.getDownloadURLs.mockResolvedValue(downloadLink("https://cdn/free.7z"));

      await expect(resolve(MOD_URL)).resolves.toMatchObject({
        urls: ["https://cdn/free.7z"],
      });
      expect(harness.freeUserQueue()).toEqual([]);
    });

    test("skips the free-user path entirely for a keyed link", async ({ makeNxm }) => {
      const { harness, resolve } = makeNxm({ userInfo: FREE });
      harness.getDownloadURLs.mockResolvedValue(downloadLink("https://cdn/keyed.7z"));

      await expect(resolve(`${MOD_URL}?key=abc&expires=1700000000`)).resolves.toMatchObject({
        urls: ["https://cdn/keyed.7z"],
      });
      // the site already authorised this link, so no mod-info lookup and no queueing
      expect(modInfoQuery).not.toHaveBeenCalled();
      expect(harness.freeUserQueue()).toEqual([]);
    });

    test("queues the download when the mod info lookup fails", async ({ makeNxm }) => {
      const { harness, nxm, resolve } = makeNxm({ userInfo: FREE });
      modInfoQuery.mockRejectedValue(new Error("network down"));

      const pending = resolve(MOD_URL);
      await queued(harness);

      nxm.dialogHandlers.onCancel(MOD_URL);
      await expect(pending).rejects.toBeInstanceOf(UserCanceled);
    });

    test("propagates a cancellation instead of re-queueing the download", async ({ makeNxm }) => {
      const { harness, resolve } = makeNxm({ userInfo: FREE });
      modInfoQuery.mockRejectedValue(new UserCanceled());

      await expect(resolve(MOD_URL)).rejects.toBeInstanceOf(UserCanceled);
      expect(harness.freeUserQueue()).toEqual([]);
    });

    test("takes the free path for a premium account when downloads are forced free", async ({
      makeNxm,
    }) => {
      vi.stubEnv("FORCE_FREE_DOWNLOADS", "yes");
      const { harness, nxm, resolve } = makeNxm();
      websiteRoundTrip();

      const pending = resolve(MOD_URL);
      await queued(harness);

      nxm.dialogHandlers.onCancel(MOD_URL);
      await expect(pending).rejects.toBeInstanceOf(UserCanceled);
      vi.unstubAllEnvs();
    });

    describe("the queued download", () => {
      const arrangeQueued = async (makeNxm: INxmFixtures["makeNxm"]) => {
        const { harness, nxm, resolve } = makeNxm({ userInfo: FREE });
        websiteRoundTrip();
        const pending = resolve(MOD_URL);
        await queued(harness);
        return { harness, nxm, pending };
      };

      // the dialog shows one download at a time and hides itself as soon as the membership
      // improves, so anything it left parked would have no way back
      test("retrying after an upgrade resolves every parked download, not just the shown one", async ({
        makeNxm,
      }) => {
        const { harness, nxm, resolve } = makeNxm({ userInfo: FREE });
        websiteRoundTrip();
        const first = resolve(MOD_URL);
        const second = resolve(OTHER_MOD_URL);
        await vi.waitFor(() => expect(harness.freeUserQueue()).toHaveLength(2));

        harness.getDownloadURLs.mockResolvedValue(downloadLink("https://cdn/file.7z"));
        harness.setUserInfo(PREMIUM);
        nxm.dialogHandlers.onRetry();

        await expect(first).resolves.toMatchObject({ urls: ["https://cdn/file.7z"] });
        await expect(second).resolves.toMatchObject({ urls: ["https://cdn/file.7z"] });
        expect(harness.freeUserQueue()).toEqual([]);
      });

      // what FreeUserDLDialog does when the user upgrades while the dialog is open
      test("retrying after an upgrade resolves it down the premium path", async ({ makeNxm }) => {
        const { harness, nxm, pending } = await arrangeQueued(makeNxm);
        harness.getDownloadURLs.mockResolvedValue(downloadLink("https://cdn/file.7z"));
        harness.setUserInfo(PREMIUM);

        nxm.dialogHandlers.onRetry();

        await expect(pending).resolves.toMatchObject({ urls: ["https://cdn/file.7z"] });
        expect(harness.freeUserQueue()).toEqual([]);
      });

      test("opens the file's page on the website when the user picks download there", async ({
        makeNxm,
      }) => {
        const { harness, nxm, pending } = await arrangeQueued(makeNxm);

        nxm.dialogHandlers.onDownload(MOD_URL);

        expect(openPage).toHaveBeenCalledWith(
          "https://www.nexusmods.com/skyrimspecialedition/mods/100?tab=files&file_id=500&nmm=1",
        );

        nxm.dialogHandlers.onCancel(MOD_URL);
        await expect(pending).rejects.toBeInstanceOf(UserCanceled);
      });

      test("skipping marks the mod skipped in the active collection install", async ({
        makeNxm,
      }) => {
        const { harness, nxm, pending } = await arrangeQueued(makeNxm);
        harness.getModFiles.mockResolvedValue({
          file_updates: [
            {
              old_file_id: 400,
              new_file_id: 500,
              old_file_name: "old.7z",
              new_file_name: "new.7z",
            },
          ],
        });

        nxm.dialogHandlers.onSkip(MOD_URL);

        await expect(pending).rejects.toBeInstanceOf(UserCanceled);
        expect(markSkipped).toHaveBeenCalledWith(
          harness.api,
          expect.objectContaining({
            identifiers: expect.objectContaining({
              fileIds: expect.arrayContaining(["400", "500"]),
              fileNames: expect.arrayContaining(["old.7z", "new.7z"]),
            }),
          }),
        );
      });

      test("skipping still cancels when the update chain can't be queried", async ({ makeNxm }) => {
        const { harness, nxm, pending } = await arrangeQueued(makeNxm);
        harness.getModFiles.mockRejectedValue(new Error("network down"));

        nxm.dialogHandlers.onSkip(MOD_URL);

        await expect(pending).rejects.toBeInstanceOf(UserCanceled);
      });

      test("cancelling pauses the collection install that queued it", async ({ makeNxm }) => {
        const { harness, nxm, pending } = await arrangeQueued(makeNxm);
        harness.setState((draft) => {
          draft.session["collections"].activeSession = makeSession({
            gameId: "skyrimse",
            collectionId: "coll-1",
          });
        });
        const paused = vi.fn();
        harness.api.events.on("pause-collection", paused);

        expect(nxm.dialogHandlers.onCancel(MOD_URL)).toBe(true);

        await expect(pending).rejects.toBeInstanceOf(UserCanceled);
        expect(paused).toHaveBeenCalledWith("skyrimse", "coll-1", "free-user-cancel");
      });
    });

    test("cancelling an empty queue just drops the url from the dialog", ({ makeNxm }) => {
      const { harness, nxm } = makeNxm({ userInfo: FREE });

      expect(nxm.dialogHandlers.onCancel(MOD_URL)).toBe(false);
      expect(harness.dispatched.map((action) => action.type)).toContain("REMOVE_FREEUSER_DLITEM");
    });

    test("retrying with nothing queued does nothing", ({ makeNxm }) => {
      const { harness, nxm } = makeNxm({ userInfo: FREE });

      expect(() => nxm.dialogHandlers.onRetry()).not.toThrow();
      expect(harness.getDownloadURLs).not.toHaveBeenCalled();
    });
  });

  /**
   * Cancelling a membership on the website pushes nothing to Vortex, so the cached userInfo can
   * still say premium and send the download down the api path. The api then refuses the keyless
   * download link with a 403, which is the cue to re-read the membership - never to assume it.
   */
  describe("membership that ended on the website (LAZ-836)", () => {
    const refusesKeylessLink = (harness: INxmHarness) =>
      harness.getDownloadURLs.mockRejectedValue(apiError(403, "forbidden"));

    test("re-reads the membership and downloads as a free user", async ({ makeNxm }) => {
      const { harness, nxm, resolve } = makeNxm();
      refusesKeylessLink(harness);
      harness.getUserInfo.mockResolvedValue(makeApiUserInfo({ premium: false }));
      websiteRoundTrip();

      const pending = resolve(MOD_URL);
      await vi.waitFor(() => expect(harness.freeUserQueue()).toEqual([MOD_URL]));

      // the dialog only renders for a non-premium user, so the refreshed membership has to be in
      // state by the time the download is queued
      expect(harness.getState().persistent["nexus"].userInfo).toMatchObject({ isPremium: false });

      nxm.dialogHandlers.onCancel(MOD_URL);
      await expect(pending).rejects.toBeInstanceOf(UserCanceled);
    });

    // a 403 is the server contradicting the cached membership, so no read is recent enough to
    // answer it - and during active use one almost always is, since every api call refreshes it
    test("asks the api even when the membership was just read", async ({ makeNxm }) => {
      const { harness, nxm, resolve } = makeNxm();
      refusesKeylessLink(harness);
      websiteRoundTrip();

      // something else read the membership a moment ago, and it still said premium then
      harness.getUserInfo.mockResolvedValue(makeApiUserInfo({ premium: true }));
      await refreshMembership(harness.api, harness.nexus);

      // the plan lapses, so the next read is the one that would learn about it
      harness.getUserInfo.mockClear();
      harness.getUserInfo.mockResolvedValue(makeApiUserInfo({ premium: false }));

      const pending = resolve(MOD_URL);

      await vi.waitFor(() => expect(harness.freeUserQueue()).toEqual([MOD_URL]));
      expect(harness.getUserInfo).toHaveBeenCalled();
      nxm.dialogHandlers.onCancel(MOD_URL);
      await expect(pending).rejects.toBeInstanceOf(UserCanceled);
    });

    test("keeps the original error when the account is still premium", async ({ makeNxm }) => {
      const { harness, resolve } = makeNxm();
      refusesKeylessLink(harness);
      harness.getUserInfo.mockResolvedValue(makeApiUserInfo({ premium: true }));

      const err = await resolve(MOD_URL).catch((caught: unknown) => caught);

      // the 403 was about something other than the membership
      expect(err).toBeInstanceOf(HTTPError);
      expect((err as HTTPError).statusCode).toBe(403);
      expect(harness.freeUserQueue()).toEqual([]);
    });

    test("keeps the original error when the membership can't be re-read", async ({ makeNxm }) => {
      const { harness, resolve } = makeNxm();
      refusesKeylessLink(harness);
      harness.getUserInfo.mockRejectedValue(new Error("network down"));

      const err = await resolve(MOD_URL).catch((caught: unknown) => caught);

      expect(err).toBeInstanceOf(HTTPError);
      expect((err as HTTPError).statusCode).toBe(403);
      expect(harness.freeUserQueue()).toEqual([]);
    });

    test("leaves a refusal of an authorised link alone", async ({ makeNxm }) => {
      const { harness, resolve } = makeNxm();
      refusesKeylessLink(harness);

      const err = await resolve(`${MOD_URL}?key=abc&expires=1700000000`).catch(
        (caught: unknown) => caught,
      );

      // the website authorised this link, so a refusal says nothing about the membership
      expect(err).toBeInstanceOf(HTTPError);
      expect(harness.getUserInfo).not.toHaveBeenCalled();
    });

    test("leaves any other api refusal alone", async ({ makeNxm }) => {
      const { harness, resolve } = makeNxm();
      harness.getDownloadURLs.mockRejectedValue(apiError(404, "no such file"));

      await expect(resolve(MOD_URL)).rejects.toBeInstanceOf(HTTPError);
      expect(harness.getUserInfo).not.toHaveBeenCalled();
    });
  });
});
