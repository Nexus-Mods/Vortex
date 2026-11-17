import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OwnedModFile } from "@/extensions/browse_nexus/util/delete_mod_files/deleteModFiles";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { browseModsTracking } from "@/test-utils/browseModsTracking";
import { settleTransitions } from "@/test-utils/transitions";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { useDeleteModFiles } from "./useDeleteModFiles.hook";

const mocks = vi.hoisted(() => ({
  ownedFiles: [] as OwnedModFile[],
  deleteFiles: vi.fn(),
  uninstalling: false,
}));

vi.mock("react-redux", () => ({
  useSelector: (selector: () => unknown) => selector(),
}));
vi.mock("@/util/selectors", () => ({ activeGameId: () => "skyrimse" }));
vi.mock("@/extensions/browse_nexus/util/delete_mod_files/deleteModFiles", () => ({
  ownedModFilesIn: () => mocks.ownedFiles,
  ownedFileKey: (file: OwnedModFile) =>
    file.kind === "installed" ? `mod:${file.modId}` : `download:${file.downloadId}`,
  deleteModFiles: mocks.deleteFiles,
  isUninstallingIn: () => mocks.uninstalling,
  removalCounts: (chosen: OwnedModFile[], deleteDownloads: boolean) => ({
    deleted: deleteDownloads ? chosen.length : 0,
    uninstalled: deleteDownloads ? 0 : chosen.length,
  }),
}));

const mod = {
  id: "7340033",
  game_scoped_id: "1",
  game: { id: "1704", domain_name: "skyrimspecialedition" },
  name: "SkyUI",
} as unknown as ModSummary;

const installedFile: OwnedModFile = {
  kind: "installed",
  modId: "skyui",
  archiveId: "dl-skyui",
  hasDownload: true,
  otherArchiveUsers: [],
  name: "SkyUI (v5.2)",
};

const downloadedFile: OwnedModFile = {
  kind: "downloaded",
  downloadId: "dl-patch",
  name: "SkyUI Patch (v1.0)",
};

const sendNotification = vi.fn();
const api = { getState: () => ({}), sendNotification } as unknown as IExtensionApi;

/**
 * A button that runs the hook's Delete, the modal it renders, and whether it says the mod is
 * uninstalling. A new `opener` swaps the button for another, as the install button's changes.
 */
const Host = ({ opener = "first" }: { opener?: string }) => {
  const openerRef = useRef<HTMLButtonElement>(null);
  const { deleteAction, modal, isDeleting } = useDeleteModFiles(api, mod, openerRef);

  return (
    <>
      <button
        data-deleting={isDeleting}
        data-testid="opener"
        key={opener}
        ref={openerRef}
        onClick={() => deleteAction.onClick?.()}
      />

      {modal}
    </>
  );
};

/** A fresh query client for each test, as the delete runs as a mutation, and its tracking. */
let client: QueryClient;
let tracking: ReturnType<typeof browseModsTracking>;

const withClient = (ui: React.ReactElement) => (
  <tracking.wrapper>
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  </tracking.wrapper>
);

/** The properties of the events of one name sent so far. */
const sent = (eventName: string) => tracking.tracked(eventName).map((event) => event.properties);

const openModal = async () => {
  const view = render(withClient(<Host />));
  await userEvent.click(screen.getByTestId("opener"));
  return view;
};

describe("useDeleteModFiles", () => {
  beforeEach(() => {
    mocks.ownedFiles = [];
    client = new QueryClient();
    tracking = browseModsTracking();
    mocks.deleteFiles.mockReset().mockResolvedValue(undefined);
    mocks.uninstalling = false;
    sendNotification.mockReset();
  });

  it("says when the mod's files are uninstalling", () => {
    mocks.uninstalling = true;
    render(withClient(<Host />));

    expect(screen.getByTestId("opener")).toHaveAttribute("data-deleting", "true");
  });

  /** Confirms deleting the user's one file, the delete running until `finish` is called. */
  const startDelete = async () => {
    let finish = () => {};
    mocks.deleteFiles.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    mocks.ownedFiles = [installedFile];
    const view = await openModal();

    await userEvent.click(await screen.findByTestId("delete-mod-files-delete"));
    await settleTransitions();

    return { view, finish: () => act(async () => finish()) };
  };

  it("says the mod's files are being deleted until every deletion has finished", async () => {
    const { finish } = await startDelete();

    expect(screen.getByTestId("opener")).toHaveAttribute("data-deleting", "true");
    await finish();

    await waitFor(() =>
      expect(screen.getByTestId("opener")).toHaveAttribute("data-deleting", "false"),
    );
  });

  it("still says the files are being deleted after the details are shown again", async () => {
    const { view, finish } = await startDelete();

    view.unmount();
    render(withClient(<Host />));

    expect(screen.getByTestId("opener")).toHaveAttribute("data-deleting", "true");
    await finish();

    await waitFor(() =>
      expect(screen.getByTestId("opener")).toHaveAttribute("data-deleting", "false"),
    );
  });

  it("returns focus to the button once the delete is over, if it fell to the page", async () => {
    const { finish } = await startDelete();

    act(() => screen.getByTestId("opener").blur());
    await finish();

    await waitFor(() => expect(screen.getByTestId("opener")).toHaveFocus());
  });

  it("returns focus to the button that replaced the one it was on", async () => {
    const { view, finish } = await startDelete();

    view.rerender(withClient(<Host opener="second" />));
    await finish();

    await waitFor(() => expect(screen.getByTestId("opener")).toHaveFocus());
  });

  it("uninstalls the file the user confirms, keeping its download", async () => {
    mocks.ownedFiles = [installedFile];
    await openModal();

    await userEvent.click(await screen.findByTestId("delete-mod-files-delete"));

    expect(mocks.deleteFiles).toHaveBeenCalledWith(api, "skyrimse", [installedFile], {
      deleteArchives: false,
    });
    await settleTransitions();
  });

  it("deletes downloads too when the user asks", async () => {
    mocks.ownedFiles = [installedFile, downloadedFile];
    await openModal();

    await userEvent.click(await screen.findByTestId("delete-mod-files-downloads"));
    await userEvent.click(screen.getByTestId("delete-mod-files-delete"));

    expect(mocks.deleteFiles).toHaveBeenCalledWith(
      api,
      "skyrimse",
      [installedFile, downloadedFile],
      { deleteArchives: true },
    );
    await settleTransitions();
  });

  it("says so, rather than opening, when the user has no files of the mod", async () => {
    await openModal();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(sendNotification).toHaveBeenCalledWith(expect.objectContaining({ type: "info" }));
  });

  it("returns focus to the opener when the user keeps their files", async () => {
    mocks.ownedFiles = [installedFile, downloadedFile];
    await openModal();

    await userEvent.click(await screen.findByTestId("delete-mod-files-cancel"));

    await waitFor(() => expect(screen.getByTestId("opener")).toHaveFocus());
    expect(mocks.deleteFiles).not.toHaveBeenCalled();
  });

  describe("tracking", () => {
    it("counts Delete picked, with how many files it found", async () => {
      mocks.ownedFiles = [installedFile, downloadedFile];
      await openModal();

      expect(sent("browse_mods_delete_clicked")).toEqual([{ mod_uid: "7340033", file_count: 2 }]);
      await settleTransitions();
    });

    it("counts Delete picked when there was nothing to remove", async () => {
      await openModal();

      expect(sent("browse_mods_delete_clicked")).toEqual([{ mod_uid: "7340033", file_count: 0 }]);
    });

    it("counts a confirmed delete, as files deleted and uninstalled", async () => {
      mocks.ownedFiles = [installedFile];
      await openModal();

      await userEvent.click(await screen.findByTestId("delete-mod-files-delete"));

      expect(sent("browse_mods_delete_confirmed")).toEqual([
        { mod_uid: "7340033", deleted_count: 0, uninstalled_count: 1, deletes_downloads: false },
      ]);
      expect(sent("browse_mods_delete_cancelled")).toEqual([]);
      await settleTransitions();
    });

    it("counts the modal closed without removing anything", async () => {
      mocks.ownedFiles = [installedFile, downloadedFile];
      await openModal();

      await userEvent.click(await screen.findByTestId("delete-mod-files-cancel"));

      expect(sent("browse_mods_delete_cancelled")).toEqual([{ mod_uid: "7340033", file_count: 2 }]);
      expect(sent("browse_mods_delete_confirmed")).toEqual([]);
      await settleTransitions();
    });
  });
});
