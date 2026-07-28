import PromiseBB from "bluebird";
import { beforeEach, describe, expect, vi } from "vitest";

import { makeDownload, makeGameStored } from "@/test-utils/builders";
import type { INxmHarness } from "@/test-utils/harnessTypes";
import type { INxmFixtures, INxmSetup } from "@/test-utils/nxmTest";
import { COLLECTION_URL, FREE, MOD_URL, test } from "@/test-utils/nxmTest";
import { ProcessCanceled, UserCanceled } from "@/util/CustomErrors";

import { SITE_ID } from "../gamemode_management/constants";
import type * as nexusUtil from "./util";
import { bringToFront, ensureLoggedIn, getInfoGraphQL, oauthCallback, startDownload } from "./util";

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

const beginDownload = vi.mocked(startDownload);
const logIn = vi.mocked(ensureLoggedIn);
const modInfoQuery = vi.mocked(getInfoGraphQL);
const focusWindow = vi.mocked(bringToFront);
const finishOAuth = vi.mocked(oauthCallback);

describe("nxm link callback", () => {
  beforeEach(() => {
    beginDownload.mockReturnValue(PromiseBB.resolve("dl-1") as never);
    logIn.mockReturnValue(PromiseBB.resolve() as never);
    modInfoQuery.mockReset();
  });

  /** The link callback only dispatches modInfo once the download record exists. */
  const arrangeLink = (setup: INxmSetup) => {
    setup.harness.setState((draft) => {
      draft.persistent.downloads.files["dl-1"] = makeDownload({ id: "dl-1" });
    });
    return { ...setup, handleLink: setup.nxm.handleLink };
  };

  const dispatchedModInfo = (harness: INxmHarness) =>
    harness.dispatched
      .filter((action) => action.type === "SET_DOWNLOAD_MODINFO")
      .map((action) => action.payload as { key: string; value: unknown });

  test("hands an oauth callback url to the login flow", ({ makeNxm }) => {
    const { harness, handleLink } = arrangeLink(makeNxm());

    handleLink("nxm://oauth/callback?code=the-code&state=the-state", false);

    expect(finishOAuth).toHaveBeenCalledWith(harness.api, "the-code", "the-state");
    expect(beginDownload).not.toHaveBeenCalled();
  });

  test("treats a premium url as a prompt to re-read the membership", ({ makeNxm }) => {
    const { onRefreshMembership, handleLink } = arrangeLink(makeNxm());

    expect(handleLink("nxm://premium", false)).toBe(false);

    expect(onRefreshMembership).toHaveBeenCalled();
    expect(beginDownload).not.toHaveBeenCalled();
  });

  test("reports an unparseable url without offering a report", ({ makeNxm }) => {
    const { harness, handleLink } = arrangeLink(makeNxm());

    handleLink("nxm://not-a-download", false);

    expect(harness.errorNotifications).toEqual([
      expect.objectContaining({ title: "Invalid URL", allowReport: false }),
    ]);
    expect(beginDownload).not.toHaveBeenCalled();
  });

  describe("extension downloads from the site domain", () => {
    const arrangeSite = (makeNxm: INxmFixtures["makeNxm"]) =>
      arrangeLink(
        makeNxm({
          knownGames: [makeGameStored({ id: SITE_ID, details: undefined })],
          availableExtensions: [{ modId: 100 }],
        }),
      );

    test("installs the extension when the link asks to install", ({ makeNxm }) => {
      const { harness, handleLink } = arrangeSite(makeNxm);
      const emitAndAwait = vi.spyOn(harness.api, "emitAndAwait");

      handleLink(`nxm://${SITE_ID}/mods/100/files/500`, true);

      expect(emitAndAwait).toHaveBeenCalledWith("install-extension", {
        name: "Pending",
        modId: 100,
        fileId: 500,
      });
    });

    test("opens the extension page when the link is only a view", ({ makeNxm }) => {
      const { harness, handleLink } = arrangeSite(makeNxm);
      const shown = vi.fn();
      harness.api.events.on("show-extension-page", shown);

      handleLink(`nxm://${SITE_ID}/mods/100/files/500`, false);

      expect(shown).toHaveBeenCalledWith(100);
      expect(focusWindow).toHaveBeenCalled();
    });
  });

  describe("mod downloads", () => {
    test("logs in, starts the download and tags it as a nexus download", async ({ makeNxm }) => {
      const { harness, handleLink } = arrangeLink(makeNxm());

      handleLink(MOD_URL, false);

      await vi.waitFor(() => expect(dispatchedModInfo(harness)).not.toHaveLength(0));
      expect(logIn).toHaveBeenCalledWith(harness.api);
      expect(beginDownload).toHaveBeenCalledWith(harness.api, harness.nexus, MOD_URL);
      expect(dispatchedModInfo(harness)).toEqual([
        expect.objectContaining({ key: "source", value: "nexus" }),
      ]);
    });

    test("installs the download when the link asks to install", async ({ makeNxm }) => {
      const { harness, handleLink } = arrangeLink(makeNxm());
      const install = vi.fn((_id: string, cb: (err: Error | null, id: string) => void) =>
        cb(null, "mod-1"),
      );
      harness.api.events.on("start-install-download", install);

      handleLink(MOD_URL, true);

      await vi.waitFor(() => expect(install).toHaveBeenCalled());
      expect(install.mock.calls[0][0]).toBe("dl-1");
    });

    test("brings the window forward when foreground downloads are enabled", ({ makeNxm }) => {
      const { harness, handleLink } = arrangeLink(makeNxm());
      harness.setState((draft) => {
        draft.settings.interface.foregroundDL = true;
      });

      handleLink(MOD_URL, false);

      expect(focusWindow).toHaveBeenCalled();
    });

    test("does nothing further when the download never started", async ({ makeNxm }) => {
      const { harness, handleLink } = arrangeLink(makeNxm());
      // the handler reports download failures itself and resolves to undefined
      beginDownload.mockReturnValue(PromiseBB.resolve(undefined) as never);

      handleLink(MOD_URL, false);

      await vi.waitFor(() => expect(beginDownload).toHaveBeenCalled());
      expect(dispatchedModInfo(harness)).toEqual([]);
    });

    test("reports a log-in failure without offering a report", async ({ makeNxm }) => {
      const { harness, handleLink } = arrangeLink(makeNxm());
      logIn.mockReturnValue(PromiseBB.reject(new ProcessCanceled("no key")) as never);

      handleLink(MOD_URL, false);

      await vi.waitFor(() =>
        expect(harness.errorNotifications).toEqual([
          expect.objectContaining({ title: "Log-in failed", allowReport: false }),
        ]),
      );
    });

    test("stays quiet when the user cancels the log in", async ({ makeNxm }) => {
      const { harness, handleLink } = arrangeLink(makeNxm());
      logIn.mockReturnValue(PromiseBB.reject(new UserCanceled()) as never);

      handleLink(MOD_URL, false);

      await vi.waitFor(() => expect(logIn).toHaveBeenCalled());
      expect(harness.errorNotifications).toEqual([]);
    });
  });

  describe("collection downloads", () => {
    test("tags the download with the revision it came from", async ({ makeNxm }) => {
      const { harness, handleLink } = arrangeLink(makeNxm());

      handleLink(COLLECTION_URL, true);

      await vi.waitFor(() => expect(dispatchedModInfo(harness)).toHaveLength(3));
      expect(dispatchedModInfo(harness)).toEqual([
        expect.objectContaining({ key: "source", value: "nexus" }),
        expect.objectContaining({ key: "collectionSlug", value: "abcdef" }),
        expect.objectContaining({ key: "revisionNumber", value: 3 }),
      ]);
    });

    test("leaves installing to the collection driver", async ({ makeNxm }) => {
      const { harness, handleLink } = arrangeLink(makeNxm());
      const install = vi.fn();
      harness.api.events.on("start-install-download", install);

      handleLink(COLLECTION_URL, true);

      await vi.waitFor(() => expect(dispatchedModInfo(harness)).not.toHaveLength(0));
      expect(install).not.toHaveBeenCalled();
    });
  });

  test("routes a site-generated link back to the download that is waiting for it", async ({
    makeNxm,
  }) => {
    const { harness, nxm, handleLink } = arrangeLink(makeNxm({ userInfo: FREE }));
    modInfoQuery.mockResolvedValue({
      modInfo: { direct_download_enabled: false },
      fileInfo: {},
    } as never);
    const pending = nxm.resolve(MOD_URL);
    await vi.waitFor(() => expect(harness.freeUserQueue()).toHaveLength(1));
    // sending the user to the website registers the link the callback should route back
    nxm.dialogHandlers.onDownload(MOD_URL);

    harness.getDownloadURLs.mockResolvedValue([{ URI: "https://cdn/file.7z" }]);
    handleLink(`${MOD_URL}?key=abc&expires=1700000000`, false);

    await expect(pending).resolves.toMatchObject({ urls: ["https://cdn/file.7z"] });
    // the awaited link is consumed by the queued download, not started as a new one
    expect(beginDownload).not.toHaveBeenCalled();
    expect(harness.freeUserQueue()).toEqual([]);
  });

  test("starts a fresh download when no queued download is waiting for the link", async ({
    makeNxm,
  }) => {
    const { nxm, handleLink } = arrangeLink(makeNxm());

    handleLink(`${MOD_URL}?key=abc&expires=1700000000`, false);

    await vi.waitFor(() => expect(beginDownload).toHaveBeenCalled());
    // nothing was queued, so there is no parked download for the link to have satisfied
    expect(nxm.dialogHandlers.onCancel(MOD_URL)).toBe(false);
  });
});
