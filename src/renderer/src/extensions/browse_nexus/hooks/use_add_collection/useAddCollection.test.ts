import type { ICollection } from "@nexusmods/nexus-api";
import { renderHook, waitFor } from "@testing-library/react";
import { VortexError } from "@vortex/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ adult: undefined as boolean | undefined }));

vi.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({ persistent: { nexus: { userInfo: { adult: mocks.adult } } } }),
}));

vi.mock("@/util/selectors", () => ({
  activeGameId: () => "skyrimse",
}));

import type { IExtensionApi } from "@/types/IExtensionContext";

import { useAddCollection } from "./useAddCollection.hook";

const collection = (adultContent = false) =>
  ({
    id: 77,
    name: "Better Skyrim",
    slug: "abc123",
    game: { id: 1704, domainName: "skyrimspecialedition" },
    latestPublishedRevision: { id: 900, revisionNumber: 4, adultContent },
  }) as unknown as ICollection;

let api: IExtensionApi;
let emit: ReturnType<typeof vi.fn>;
let showDialog: ReturnType<typeof vi.fn>;
let showErrorNotification: ReturnType<typeof vi.fn>;
let openUrl: ReturnType<typeof vi.fn>;

const add = (target: ICollection) => {
  const { result } = renderHook(() => useAddCollection(api));
  result.current(target);
};

/** The callback `start-download` was given, to answer it as the download would. */
const downloadCallback = () =>
  emit.mock.calls.find(([event]) => event === "start-download")![4] as (err: Error) => void;

describe("useAddCollection", () => {
  beforeEach(() => {
    mocks.adult = true;
    emit = vi.fn();
    showDialog = vi.fn();
    showErrorNotification = vi.fn();
    openUrl = vi.fn();
    (window.api as unknown as { shell: unknown }).shell = { openUrl };
    api = {
      events: { emit },
      showDialog,
      showErrorNotification,
      translate: (input: string) => input,
    } as unknown as IExtensionApi;
  });

  it("downloads the latest revision, as a collection of the active game, and counts the click", () => {
    add(collection());

    expect(emit).toHaveBeenCalledWith(
      "analytics-track-mixpanel-event",
      expect.objectContaining({ properties: { collection_slug: "abc123", game_id: 1704 } }),
    );
    expect(emit).toHaveBeenCalledWith(
      "start-download",
      ["nxm://skyrimspecialedition/collections/abc123/revisions/4"],
      expect.objectContaining({
        game: "skyrimse",
        source: "nexus",
        nexus: {
          ids: {
            gameId: "skyrimspecialedition",
            collectionId: 77,
            revisionId: 900,
            collectionSlug: "abc123",
            revisionNumber: 4,
          },
        },
      }),
      undefined,
      expect.any(Function),
      undefined,
      { allowInstall: "force" },
    );
  });

  it("offers the site preferences instead, for adult content the user hides", async () => {
    mocks.adult = false;
    showDialog.mockResolvedValue({ action: "Open site preferences" });

    add(collection(true));

    await waitFor(() =>
      expect(openUrl).toHaveBeenCalledWith("https://next.nexusmods.com/settings/content-blocking"),
    );
    expect(emit.mock.calls.some(([event]) => event === "start-download")).toBe(false);
  });

  it("leaves the site preferences closed when the warning is cancelled", async () => {
    mocks.adult = false;
    showDialog.mockResolvedValue({ action: "Cancel" });

    add(collection(true));

    await waitFor(() => expect(showDialog).toHaveBeenCalled());
    await Promise.resolve();
    expect(openUrl).not.toHaveBeenCalled();
  });

  it("downloads adult content for a user who shows it", () => {
    add(collection(true));

    expect(showDialog).not.toHaveBeenCalled();
    expect(emit.mock.calls.some(([event]) => event === "start-download")).toBe(true);
  });

  it("says nothing when the user cancels the download", () => {
    add(collection());

    downloadCallback()(
      new VortexError("canceled by user", { kind: "user-canceled", skipped: false }),
    );

    expect(showErrorNotification).not.toHaveBeenCalled();
  });

  it("reports a download that fails", () => {
    add(collection());
    const error = new Error("Disk full");

    downloadCallback()(error);

    expect(showErrorNotification).toHaveBeenCalledWith("Failed to add collection", error);
  });
});
