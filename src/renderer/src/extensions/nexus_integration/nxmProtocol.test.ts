import { NexusError, RateLimitError } from "@nexusmods/nexus-api";
import PromiseBB from "bluebird";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";

import { makeGameStored, makeNxmHarness, makeSession } from "@/test-utils/builders";
import { test } from "@/test-utils/harnessTest";
import type { INxmHarness, INxmHarnessOpts } from "@/test-utils/harnessTypes";
import { DataInvalid, HTTPError, ProcessCanceled, UserCanceled } from "@/util/CustomErrors";

import { markCollectionMemberSkipped } from "../../util/collectionSkip";
import opn from "../../util/opn";
import { SITE_ID } from "../gamemode_management/constants";
import { makeNXMProtocol, onCancelImpl, onDownloadImpl, onRetryImpl, onSkip } from "./nxmProtocol";
import { getInfoGraphQL } from "./util";

vi.mock("./util", () => ({
  bringToFront: vi.fn(),
  ensureLoggedIn: vi.fn(() => PromiseBB.resolve()),
  getInfoGraphQL: vi.fn(),
  oauthCallback: vi.fn(),
  startDownload: vi.fn(() => PromiseBB.resolve("dl-1")),
}));

vi.mock("../../util/opn", () => ({ default: vi.fn(() => PromiseBB.resolve()) }));

vi.mock("../../util/collectionSkip", () => ({ markCollectionMemberSkipped: vi.fn() }));

const MOD_URL = "nxm://skyrimspecialedition/mods/100/files/500";
const COLLECTION_URL = "nxm://skyrimspecialedition/collections/abcdef/revisions/3";

const PREMIUM = { userId: 7, name: "premium-user", isPremium: true };
const FREE = { userId: 7, name: "free-user", isPremium: false };

const modInfoQuery = vi.mocked(getInfoGraphQL);
const openPage = vi.mocked(opn);
const markSkipped = vi.mocked(markCollectionMemberSkipped);

/** A resolved download link, in the shape the v1 API returns. */
const downloadLink = (uri: string) => [{ URI: uri, short_name: "cdn", name: "CDN" }];

/** An API refusal, as nexus-api raises it before the handler maps it to an HTTPError. */
const apiError = (statusCode: number, message: string) =>
  new NexusError(message, statusCode, "https://api/download_link", message);

describe("nxm protocol resolver", () => {
  // the handler holds its free-download queue in module scope, so anything a test leaves queued
  // has to be rejected before the next one runs
  const openQueues: INxmHarness[] = [];

  beforeEach(() => {
    modInfoQuery.mockReset();
  });

  afterEach(() => {
    openQueues.forEach((harness) =>
      harness.freeUserQueue().forEach((url) => onCancelImpl(harness.api, url)),
    );
    openQueues.length = 0;
  });

  const arrange = (opts: INxmHarnessOpts = {}) => {
    const harness = makeNxmHarness({ userInfo: PREMIUM, ...opts });
    openQueues.push(harness);
    return { harness, resolve: makeNXMProtocol(harness.api, harness.nexus) };
  };

  test("rejects a url that isn't an nxm link", async () => {
    const { resolve } = arrange();
    await expect(resolve("not-a-url")).rejects.toBeInstanceOf(DataInvalid);
  });

  test("rejects a link generated for a different account, without offering a report", async () => {
    const { harness, resolve } = arrange();

    await expect(resolve(`${MOD_URL}?user_id=99`)).rejects.toBeInstanceOf(ProcessCanceled);
    expect(harness.errorNotifications).toEqual([
      expect.objectContaining({ title: "Invalid download links", allowReport: false }),
    ]);
  });

  test("rejects an nxm url that isn't a download link", async () => {
    const { resolve } = arrange();
    await expect(resolve("nxm://premium")).rejects.toThrow("Not a download url");
  });

  describe("premium account", () => {
    test("resolves a mod file to its download urls and nexus ids", async () => {
      const { harness, resolve } = arrange();
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

    test("forwards the key and expiry of a site-generated link", async () => {
      const { harness, resolve } = arrange();
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

    test("serves a repeated request for the same file from the cache", async () => {
      const { harness, resolve } = arrange();
      harness.getDownloadURLs.mockResolvedValue(downloadLink("https://cdn/file.7z"));

      await resolve(MOD_URL);
      await resolve(MOD_URL);

      expect(harness.getDownloadURLs).toHaveBeenCalledTimes(1);
    });

    test("resolves a collection revision through its download link", async () => {
      const { harness, resolve } = arrange();
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

    test("asks for the latest revision when the url says latest", async () => {
      const { harness, resolve } = arrange();
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

    test("annotates a failed collection lookup with the revision it was for", async () => {
      const { harness, resolve } = arrange();
      harness.getCollectionRevisionGraph.mockRejectedValue(new Error("boom"));

      await expect(resolve(COLLECTION_URL)).rejects.toMatchObject({
        collectionSlug: "abcdef",
        revisionNumber: 3,
      });
    });

    test("still uses the premium path for a site (extension) download", async () => {
      const { harness, resolve } = arrange({
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
    test("turns a nexus api error into an HTTPError carrying the status code", async () => {
      const { harness, resolve } = arrange();
      harness.getDownloadURLs.mockRejectedValue(apiError(500, "server exploded"));

      const err = await resolve(MOD_URL).catch((caught: unknown) => caught);

      expect(err).toBeInstanceOf(HTTPError);
      expect((err as HTTPError).statusCode).toBe(500);
    });

    test("reports a 401 as a log-in problem rather than a raw http error", async () => {
      const { harness, resolve } = arrange();
      harness.getDownloadURLs.mockRejectedValue(apiError(401, "unauthorized"));

      await expect(resolve(MOD_URL)).rejects.toThrow("You are not logged in to Nexus Mods!");
    });

    test("shows a non-reportable notification when the api rate limit is hit", async () => {
      const { harness, resolve } = arrange();
      harness.getDownloadURLs.mockRejectedValue(new RateLimitError());

      await expect(resolve(MOD_URL)).rejects.toBeInstanceOf(RateLimitError);
      expect(harness.errorNotifications).toEqual([
        expect.objectContaining({ title: "Rate limit exceeded", allowReport: false }),
      ]);
    });
  });

  describe("free account", () => {
    const websiteRoundTrip = () =>
      modInfoQuery.mockResolvedValue({
        modInfo: { direct_download_enabled: false },
        fileInfo: {},
      } as never);

    const queued = (harness: INxmHarness) =>
      vi.waitFor(() => expect(harness.freeUserQueue()).toHaveLength(1));

    test("queues the download for the site round trip", async () => {
      const { harness, resolve } = arrange({ userInfo: FREE });
      websiteRoundTrip();

      const pending = resolve(MOD_URL);
      await queued(harness);

      expect(harness.freeUserQueue()).toEqual([MOD_URL]);
      expect(harness.getDownloadURLs).not.toHaveBeenCalled();

      onCancelImpl(harness.api, MOD_URL);
      await expect(pending).rejects.toBeInstanceOf(UserCanceled);
    });

    test("downloads a direct-download mod in app instead of queueing it", async () => {
      const { harness, resolve } = arrange({ userInfo: FREE });
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

    test("skips the free-user path entirely for a keyed link", async () => {
      const { harness, resolve } = arrange({ userInfo: FREE });
      harness.getDownloadURLs.mockResolvedValue(downloadLink("https://cdn/keyed.7z"));

      await expect(resolve(`${MOD_URL}?key=abc&expires=1700000000`)).resolves.toMatchObject({
        urls: ["https://cdn/keyed.7z"],
      });
      // the site already authorised this link, so no mod-info lookup and no queueing
      expect(modInfoQuery).not.toHaveBeenCalled();
      expect(harness.freeUserQueue()).toEqual([]);
    });

    test("queues the download when the mod info lookup fails", async () => {
      const { harness, resolve } = arrange({ userInfo: FREE });
      modInfoQuery.mockRejectedValue(new Error("network down"));

      const pending = resolve(MOD_URL);
      await queued(harness);

      onCancelImpl(harness.api, MOD_URL);
      await expect(pending).rejects.toBeInstanceOf(UserCanceled);
    });

    test("propagates a cancellation instead of re-queueing the download", async () => {
      const { harness, resolve } = arrange({ userInfo: FREE });
      modInfoQuery.mockRejectedValue(new UserCanceled());

      await expect(resolve(MOD_URL)).rejects.toBeInstanceOf(UserCanceled);
      expect(harness.freeUserQueue()).toEqual([]);
    });

    test("takes the free path for a premium account when downloads are forced free", async () => {
      vi.stubEnv("FORCE_FREE_DOWNLOADS", "yes");
      const { harness, resolve } = arrange();
      websiteRoundTrip();

      const pending = resolve(MOD_URL);
      await queued(harness);

      onCancelImpl(harness.api, MOD_URL);
      await expect(pending).rejects.toBeInstanceOf(UserCanceled);
      vi.unstubAllEnvs();
    });

    describe("the queued download", () => {
      const arrangeQueued = async () => {
        const { harness, resolve } = arrange({ userInfo: FREE });
        websiteRoundTrip();
        const pending = resolve(MOD_URL);
        await queued(harness);
        return { harness, resolve, pending };
      };

      // what FreeUserDLDialog does when the user upgrades while the dialog is open
      test("retrying after an upgrade resolves it down the premium path", async () => {
        const { harness, resolve, pending } = await arrangeQueued();
        harness.getDownloadURLs.mockResolvedValue(downloadLink("https://cdn/file.7z"));
        harness.setUserInfo(PREMIUM);

        onRetryImpl(resolve, harness.api, MOD_URL);

        await expect(pending).resolves.toMatchObject({ urls: ["https://cdn/file.7z"] });
        expect(harness.freeUserQueue()).toEqual([]);
      });

      test("opens the file's page on the website when the user picks download there", async () => {
        const { harness, pending } = await arrangeQueued();

        onDownloadImpl(makeNXMProtocol(harness.api, harness.nexus), MOD_URL);

        expect(openPage).toHaveBeenCalledWith(
          "https://www.nexusmods.com/skyrimspecialedition/mods/100?tab=files&file_id=500&nmm=1",
        );

        onCancelImpl(harness.api, MOD_URL);
        await expect(pending).rejects.toBeInstanceOf(UserCanceled);
      });

      test("skipping marks the mod skipped in the active collection install", async () => {
        const { harness, pending } = await arrangeQueued();
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

        onSkip(harness.api, MOD_URL);

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

      test("skipping still cancels when the update chain can't be queried", async () => {
        const { harness, pending } = await arrangeQueued();
        harness.getModFiles.mockRejectedValue(new Error("network down"));

        onSkip(harness.api, MOD_URL);

        await expect(pending).rejects.toBeInstanceOf(UserCanceled);
      });

      test("cancelling pauses the collection install that queued it", async () => {
        const { harness, pending } = await arrangeQueued();
        harness.setState((draft) => {
          draft.session["collections"].activeSession = makeSession({
            gameId: "skyrimse",
            collectionId: "coll-1",
          });
        });
        const paused = vi.fn();
        harness.api.events.on("pause-collection", paused);

        expect(onCancelImpl(harness.api, MOD_URL)).toBe(true);

        await expect(pending).rejects.toBeInstanceOf(UserCanceled);
        expect(paused).toHaveBeenCalledWith("skyrimse", "coll-1", "free-user-cancel");
      });
    });

    test("cancelling an empty queue just drops the url from the dialog", () => {
      const { harness } = arrange({ userInfo: FREE });

      expect(onCancelImpl(harness.api, MOD_URL)).toBe(false);
      expect(harness.dispatched.map((action) => action.type)).toContain("REMOVE_FREEUSER_DLITEM");
    });

    test("retrying a url that isn't queued does nothing", () => {
      const { harness, resolve } = arrange({ userInfo: FREE });

      expect(() => onRetryImpl(resolve, harness.api, MOD_URL)).not.toThrow();
      expect(harness.getDownloadURLs).not.toHaveBeenCalled();
    });
  });

  describe("membership that ended on the website (LAZ-836)", () => {
    /**
     * Cancelling a membership on the website pushes nothing to Vortex, so the cached userInfo
     * still says premium and the resolver takes the premium path. The API then refuses the
     * keyless download link, and today that refusal reaches the caller as a raw HTTP error
     * instead of the free-user flow the account is now entitled to.
     */
    test("surfaces the refused download link as a raw http error", async () => {
      const { harness, resolve } = arrange({ userInfo: PREMIUM });
      harness.getDownloadURLs.mockRejectedValue(apiError(403, "forbidden"));

      const err = await resolve(MOD_URL).catch((caught: unknown) => caught);

      expect(err).toBeInstanceOf(HTTPError);
      expect((err as HTTPError).statusCode).toBe(403);
      // the download never reaches the free-user dialog the account now qualifies for
      expect(harness.freeUserQueue()).toEqual([]);
      // and the stale membership stays in place, so the next attempt fails the same way
      expect(harness.getState().persistent["nexus"].userInfo).toMatchObject({ isPremium: true });
    });
  });
});
