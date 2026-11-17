import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OwnedModFile } from "@/extensions/browse_nexus/util/delete_mod_files/deleteModFiles";
import { settleTransitions } from "@/test-utils/transitions";

import { DeleteModFilesModal } from "./DeleteModFilesModal";

const installedFile: OwnedModFile = {
  kind: "installed",
  modId: "skyui",
  archiveId: "dl-skyui",
  hasDownload: true,
  otherArchiveUsers: [],
  name: "SkyUI (v5.2)",
};

const missingFile: OwnedModFile = {
  kind: "installed",
  modId: "skyui-lite",
  archiveId: "dl-gone",
  hasDownload: false,
  otherArchiveUsers: [],
  name: "SkyUI Lite (v5.2)",
};

const downloadedFile: OwnedModFile = {
  kind: "downloaded",
  downloadId: "dl-patch",
  name: "SkyUI Patch (v1.0)",
};

let onDelete: ReturnType<typeof vi.fn<(files: OwnedModFile[], deleteDownloads: boolean) => void>>;
let onClose: ReturnType<typeof vi.fn<() => void>>;

const renderModal = (files: OwnedModFile[]) =>
  render(
    <DeleteModFilesModal files={files} modName="SkyUI" onClose={onClose} onDelete={onDelete} />,
  );

const removeButton = () => screen.getByTestId("delete-mod-files-delete");
const deleteDownloads = () => screen.getByTestId("delete-mod-files-downloads");
const fileBoxes = () => screen.getAllByTestId("delete-mod-files-file");

describe("DeleteModFilesModal", () => {
  beforeEach(() => {
    onDelete = vi.fn();
    onClose = vi.fn();
  });

  describe("for several files", () => {
    it("uninstalls the installed files by default, keeping downloads", async () => {
      renderModal([installedFile, downloadedFile]);

      expect(fileBoxes().map((box) => box.getAttribute("aria-checked"))).toEqual(["true", "false"]);
      expect(fileBoxes()[1]).toHaveAttribute("aria-disabled", "true");
      await userEvent.click(removeButton());

      expect(onDelete).toHaveBeenCalledWith([installedFile], false);
      await settleTransitions();
    });

    it("ticks and unlocks uninstalled files once downloads are to be deleted", async () => {
      renderModal([installedFile, downloadedFile]);

      await userEvent.click(deleteDownloads());

      expect(fileBoxes().map((box) => box.getAttribute("aria-checked"))).toEqual(["true", "true"]);
      await userEvent.click(removeButton());

      expect(onDelete).toHaveBeenCalledWith([installedFile, downloadedFile], true);
      await settleTransitions();
    });

    it("unticks uninstalled files again when downloads are to be kept", async () => {
      renderModal([installedFile, downloadedFile]);

      await userEvent.click(deleteDownloads());
      await userEvent.click(deleteDownloads());
      await userEvent.click(removeButton());

      expect(onDelete).toHaveBeenCalledWith([installedFile], false);
      await settleTransitions();
    });

    it("removes only the files left ticked, turning the action off while none are", async () => {
      renderModal([installedFile, missingFile]);

      await userEvent.click(fileBoxes()[0]);
      await userEvent.click(removeButton());
      expect(onDelete).toHaveBeenCalledWith([missingFile], false);

      await userEvent.click(fileBoxes()[1]);
      expect(removeButton()).toBeDisabled();
      await settleTransitions();
    });

    it("forces deleting downloads on when nothing is installed", async () => {
      const otherDownload: OwnedModFile = { ...downloadedFile, downloadId: "dl-other" };
      renderModal([downloadedFile, otherDownload]);

      expect(deleteDownloads()).toHaveAttribute("aria-checked", "true");
      expect(deleteDownloads()).toHaveAttribute("aria-disabled", "true");
      await userEvent.click(removeButton());

      expect(onDelete).toHaveBeenCalledWith([downloadedFile, otherDownload], true);
      await settleTransitions();
    });
  });

  describe("the action", () => {
    it("uninstalls as a neutral action while every chosen file keeps its download", async () => {
      renderModal([installedFile]);

      expect(removeButton()).toHaveClass("nxm-button-neutral");
      await userEvent.click(deleteDownloads());

      expect(removeButton()).toHaveClass("nxm-button-danger");
      await settleTransitions();
    });

    it("deletes as a danger action when a chosen file has no download to keep", async () => {
      renderModal([installedFile, missingFile]);

      expect(removeButton()).toHaveClass("nxm-button-danger");
      await userEvent.click(fileBoxes()[1]);

      expect(removeButton()).toHaveClass("nxm-button-neutral");
      await settleTransitions();
    });
  });

  describe("a download shared with another mod", () => {
    const variantA: OwnedModFile = { ...installedFile, modId: "a", otherArchiveUsers: ["b"] };
    const variantB: OwnedModFile = { ...installedFile, modId: "b", otherArchiveUsers: ["a"] };

    it("only uninstalls a file whose download another mod not chosen still uses", async () => {
      renderModal([variantA, variantB]);

      await userEvent.click(fileBoxes()[1]);
      await userEvent.click(deleteDownloads());

      expect(removeButton()).toHaveClass("nxm-button-neutral");
      await settleTransitions();
    });

    it("deletes it for good once every mod using it is chosen", async () => {
      renderModal([variantA, variantB]);

      await userEvent.click(deleteDownloads());

      expect(removeButton()).toHaveClass("nxm-button-danger");
      await settleTransitions();
    });
  });

  describe("warnings", () => {
    it("warns of a ticked file whose download is missing, until it's unticked", async () => {
      renderModal([installedFile, missingFile]);

      expect(screen.getByTestId("delete-mod-files-missing-downloads")).toBeInTheDocument();
      await userEvent.click(fileBoxes()[1]);

      expect(screen.queryByTestId("delete-mod-files-missing-downloads")).not.toBeInTheDocument();
      await settleTransitions();
    });
  });

  describe("for one file", () => {
    it("uninstalls it without a list, keeping its download", async () => {
      renderModal([installedFile]);

      expect(screen.getAllByRole("checkbox")).toEqual([deleteDownloads()]);
      expect(deleteDownloads()).toHaveAccessibleDescription();
      await userEvent.click(removeButton());

      expect(onDelete).toHaveBeenCalledWith([installedFile], false);
      await settleTransitions();
    });

    it("deletes its download too when the user asks", async () => {
      renderModal([installedFile]);

      await userEvent.click(deleteDownloads());
      await userEvent.click(removeButton());

      expect(onDelete).toHaveBeenCalledWith([installedFile], true);
      await settleTransitions();
    });

    it("can't delete the download of a file whose download is missing", async () => {
      renderModal([missingFile]);

      expect(deleteDownloads()).toHaveAttribute("aria-disabled", "true");
      expect(deleteDownloads()).toHaveAttribute("aria-checked", "false");
      expect(deleteDownloads()).not.toHaveAccessibleDescription();
      await settleTransitions();
    });

    it("can only delete a file that's only downloaded", async () => {
      renderModal([downloadedFile]);

      expect(deleteDownloads()).toHaveAttribute("aria-disabled", "true");
      await userEvent.click(removeButton());

      expect(onDelete).toHaveBeenCalledWith([downloadedFile], true);
      await settleTransitions();
    });
  });

  it("keeps the files when the user cancels", async () => {
    renderModal([installedFile, downloadedFile]);

    await userEvent.click(screen.getByTestId("delete-mod-files-cancel"));

    expect(onClose).toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    await settleTransitions();
  });
});
