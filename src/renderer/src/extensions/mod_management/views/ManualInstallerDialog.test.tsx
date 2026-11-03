import { relativePath } from "@nexusmods/paths";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VortexGameId, VortexModStagingFolder } from "@vortex/shared";
import { QualifiedPath } from "@vortex/shared/filesystem";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installInMemoryFS } from "@/test-utils/fsApi";
import type { FileTreeEntry } from "@/ui/components/file_tree/buildTree";

import { normalizeDestination } from "../manualInstaller";
import type { IManualInstallerRequest } from "../reducers/manualInstaller";
import type { IDeploymentManifest } from "../types/IDeploymentManifest";
import { ManualInstallerDialog } from "./ManualInstallerDialog";

// --- Helpers ---

const gameFolder = QualifiedPath.fromNative("/game");

const text = { type: "text", data: "x" } as const;

const file = (path: string): FileTreeEntry => ({ path: relativePath(path), kind: "file" });

const directory = (path: string): FileTreeEntry => ({
  path: relativePath(path),
  kind: "directory",
});

const archive = [directory("Top"), file("Top/new.dll"), file("Top/Game.esm")];

const request = (overrides: Partial<IManualInstallerRequest> = {}): IManualInstallerRequest => ({
  id: "request",
  gameId: VortexGameId("game"),
  modName: "My Mod",
  remaining: 0,
  gameFolder: "/game",
  files: archive,
  ownStagingFolders: [],
  topFolder: "Top",
  ...overrides,
});

const manifest = (files: IDeploymentManifest["files"] = []): IDeploymentManifest => ({
  version: 1,
  instance: "instance",
  files,
});

const renderDialog = (
  overrides: Partial<IManualInstallerRequest> = {},
  loadManifest = vi.fn().mockResolvedValue(manifest()),
) => {
  const onAnswer = vi.fn();

  render(
    <ManualInstallerDialog
      loadManifest={loadManifest}
      modNames={new Map()}
      request={request(overrides)}
      visible
      onAnswer={onAnswer}
    />,
  );

  return { loadManifest, onAnswer };
};

const gameTree = () => screen.getByTestId("manual-installer-game-tree");

const gameItem = async (path: string): Promise<HTMLElement> =>
  waitFor(() => {
    const found = within(gameTree())
      .queryAllByRole("treeitem")
      .find((element) => element.dataset.path === path);

    if (found === undefined) {
      throw new Error(`No game tree item for "${path}"`);
    }

    return found;
  });

const toggle = (item: HTMLElement) => within(item).getByTestId("file-tree-toggle");

const install = () => screen.getByTestId("manual-installer-install");

describe("ManualInstallerDialog", () => {
  let restore: () => void;

  beforeEach(() => {
    restore = installInMemoryFS((builder) => {
      builder.file(gameFolder.join("game.exe"), text);
      builder.file(gameFolder.join("Data", "Game.esm"), text);
      builder.file(gameFolder.join("Data", "Sub", "deep.txt"), text);
      builder.file(gameFolder.join("Mods", "readme.txt"), text);
    }).restore;
  });

  afterEach(() => {
    restore();
  });

  it("shows nothing when there is no request", () => {
    const { container } = render(
      <ManualInstallerDialog
        loadManifest={vi.fn()}
        modNames={new Map()}
        request={undefined}
        visible
        onAnswer={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the archive's files and the game folder as trees", async () => {
    renderDialog();

    const archiveTree = screen.getByTestId("manual-installer-archive-tree");
    const archivePaths = within(archiveTree)
      .getAllByRole("treeitem")
      .map((element) => element.dataset.path);

    // the archive's top level directories start open
    expect(archivePaths).toEqual(["Top", "Top/Game.esm", "Top/new.dll"]);

    expect(await gameItem("Data")).toBeInTheDocument();
    expect(await gameItem("game.exe")).toBeInTheDocument();
  });

  it("installs to the game root unless another folder is picked", async () => {
    const user = userEvent.setup();
    const { onAnswer } = renderDialog();

    await user.click(install());

    expect(onAnswer).toHaveBeenCalledWith("request", expect.objectContaining({ folder: "" }));
  });

  it("installs to the directory selected in the game tree", async () => {
    const user = userEvent.setup();
    const { onAnswer } = renderDialog();

    await user.click(await gameItem("Data"));
    await user.click(install());

    expect(onAnswer).toHaveBeenCalledWith("request", expect.objectContaining({ folder: "Data" }));
  });

  it("installs to a directory inside one opened with its arrow", async () => {
    const user = userEvent.setup();
    const { onAnswer } = renderDialog();

    await user.click(toggle(await gameItem("Data")));
    await user.click(await gameItem("Data/Sub"));
    await user.click(install());

    expect(onAnswer).toHaveBeenCalledWith(
      "request",
      // the answer has the platform's separators
      expect.objectContaining({ folder: normalizeDestination("Data/Sub") }),
    );
  });

  it("goes back to the game root by selecting the game folder at the top of the tree", async () => {
    const user = userEvent.setup();
    const { onAnswer } = renderDialog();

    await user.click(await gameItem("Data"));
    await user.click(await gameItem(""));
    await user.click(install());

    expect(onAnswer).toHaveBeenCalledWith("request", expect.objectContaining({ folder: "" }));
  });

  it("can't install while a file is selected, and can again after selecting a directory", async () => {
    const user = userEvent.setup();
    const { onAnswer } = renderDialog();

    await user.click(await gameItem("game.exe"));

    expect(install()).toBeDisabled();
    expect(screen.getByTestId("manual-installer-select-directory")).toBeInTheDocument();

    await user.click(await gameItem("Data"));

    expect(install()).toBeEnabled();
    expect(screen.queryByTestId("manual-installer-select-directory")).not.toBeInTheDocument();

    await user.click(install());

    expect(onAnswer).toHaveBeenCalledWith("request", expect.objectContaining({ folder: "Data" }));
  });

  it("starts at the default folder, with the directories above it opened", async () => {
    const user = userEvent.setup();
    const { onAnswer } = renderDialog({ defaultFolder: "Data/Sub" });

    const item = await gameItem("Data/Sub");
    expect(item).toHaveAttribute("aria-selected", "true");

    await user.click(install());

    expect(onAnswer).toHaveBeenCalledWith(
      "request",
      expect.objectContaining({ folder: "Data/Sub" }),
    );
  });

  it("installs to a default folder the game doesn't have", async () => {
    const user = userEvent.setup();
    const { onAnswer } = renderDialog({ defaultFolder: "Brand/New" });

    await user.click(install());

    expect(onAnswer).toHaveBeenCalledWith(
      "request",
      expect.objectContaining({ folder: "Brand/New" }),
    );
  });

  describe("new folder", () => {
    // Opens the context menu of a node of the game tree and chooses to make a folder in it, which
    // leaves the new folder's name to be typed over.
    const startNewFolder = async (user: ReturnType<typeof userEvent.setup>, path: string) => {
      fireEvent.contextMenu(await gameItem(path));
      await user.click(await screen.findByRole("menuitem"));

      return screen.findByTestId("manual-installer-folder-name");
    };

    const nameFolder = async (
      user: ReturnType<typeof userEvent.setup>,
      input: HTMLElement,
      name: string,
    ) => {
      await user.clear(input);
      await user.type(input, name);
    };

    it("makes a new folder in the game folder from the context menu of its top row", async () => {
      const user = userEvent.setup();
      const { onAnswer } = renderDialog();

      const input = await startNewFolder(user, "");
      await nameFolder(user, input, "Created{Enter}");

      expect(await gameItem("Created")).toHaveAttribute("aria-selected", "true");

      await user.click(install());

      expect(onAnswer).toHaveBeenCalledWith(
        "request",
        expect.objectContaining({ folder: "Created" }),
      );
    });

    it("makes a new folder in the directory the context menu was opened on", async () => {
      const user = userEvent.setup();
      const { onAnswer } = renderDialog();

      const input = await startNewFolder(user, "Data");
      await nameFolder(user, input, "Created{Enter}");

      expect(await gameItem("Data/Created")).toHaveAttribute("aria-selected", "true");

      await user.click(install());

      expect(onAnswer).toHaveBeenCalledWith(
        "request",
        // the answer has the platform's separators
        expect.objectContaining({ folder: normalizeDestination("Data/Created") }),
      );
    });

    it("shows the new folder at once, with what its directory holds, even if it wasn't read", async () => {
      const user = userEvent.setup();
      renderDialog();

      const input = await startNewFolder(user, "Mods");
      await nameFolder(user, input, "Created{Enter}");

      expect(await gameItem("Mods/Created")).toBeInTheDocument();
      expect(await gameItem("Mods/readme.txt")).toBeInTheDocument();
    });

    it("makes the new folder in the directory a file is in when the menu is opened on a file", async () => {
      const user = userEvent.setup();
      renderDialog();

      const input = await startNewFolder(user, "game.exe");
      await nameFolder(user, input, "Created{Enter}");

      expect(await gameItem("Created")).toBeInTheDocument();
    });

    it("takes the new folder's name when the input loses focus", async () => {
      const user = userEvent.setup();
      renderDialog();

      const input = await startNewFolder(user, "Data");
      await nameFolder(user, input, "Created");
      await user.click(screen.getByTestId("manual-installer-archive-tree"));

      expect(await gameItem("Data/Created")).toBeInTheDocument();
      expect(screen.queryByTestId("manual-installer-folder-name")).not.toBeInTheDocument();
    });

    it("drops the new folder on Escape, and goes back to the directory it was in", async () => {
      const user = userEvent.setup();
      const { onAnswer } = renderDialog();

      const input = await startNewFolder(user, "Data");
      await nameFolder(user, input, "Created{Escape}");

      expect(screen.queryByTestId("manual-installer-folder-name")).not.toBeInTheDocument();
      expect(
        within(gameTree())
          .queryAllByRole("treeitem")
          .some((element) => element.dataset.path === "Data/Created"),
      ).toBe(false);

      // Escape doesn't close the dialog, only the naming
      expect(onAnswer).not.toHaveBeenCalled();

      await user.click(install());

      expect(onAnswer).toHaveBeenCalledWith("request", expect.objectContaining({ folder: "Data" }));
    });

    it("keeps naming while the name doesn't work, even when focus leaves", async () => {
      const user = userEvent.setup();
      renderDialog();

      const input = await startNewFolder(user, "");
      await nameFolder(user, input, "Data{Enter}");

      // another folder in the game folder has that name
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("aria-invalid", "true");

      await user.click(screen.getByTestId("manual-installer-archive-tree"));

      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("aria-invalid", "true");
    });

    it("can't install while a folder is being named", async () => {
      const user = userEvent.setup();
      const { onAnswer } = renderDialog();

      const input = await startNewFolder(user, "");
      await nameFolder(user, input, "Data");

      expect(install()).toBeDisabled();

      // the click takes focus from the input first, which doesn't take a name that doesn't work
      await user.click(install());

      expect(onAnswer).not.toHaveBeenCalled();
      expect(input).toBeInTheDocument();

      await nameFolder(user, input, "Created{Enter}");

      expect(install()).toBeEnabled();
    });

    it("doesn't take a name that is a path", async () => {
      const user = userEvent.setup();
      renderDialog();

      const input = await startNewFolder(user, "");
      await nameFolder(user, input, "../outside{Enter}");

      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("aria-invalid", "true");
    });

    it("can make a second new folder after the first", async () => {
      const user = userEvent.setup();
      renderDialog();

      await nameFolder(user, await startNewFolder(user, "Data"), "First{Enter}");
      await nameFolder(user, await startNewFolder(user, "Data"), "Second{Enter}");

      expect(await gameItem("Data/First")).toBeInTheDocument();
      expect(await gameItem("Data/Second")).toBeInTheDocument();
    });
  });

  it("leaves the top folder out of the result when skipping it", async () => {
    const user = userEvent.setup();
    renderDialog();

    const result = screen.getByTestId("manual-installer-result");
    expect(result.textContent).toContain("Top/new.dll");

    await user.click(screen.getByTestId("manual-installer-skip-top-folder"));

    expect(result.textContent).not.toContain("Top");
    expect(result.textContent).toContain("new.dll");
  });

  it("answers with the skipped top folder and the checkboxes", async () => {
    const user = userEvent.setup();
    const { onAnswer } = renderDialog({ remaining: 2 });

    await user.click(screen.getByTestId("manual-installer-skip-top-folder"));
    await user.click(screen.getByTestId("manual-installer-use-as-default"));
    await user.click(screen.getByTestId("manual-installer-use-for-all"));
    await user.click(install());

    expect(onAnswer).toHaveBeenCalledWith("request", {
      folder: "",
      skipTopFolder: true,
      useAsDefault: true,
      dontAskAgain: false,
      useForAll: true,
    });
  });

  it("offers to use the answer for the rest of the batch only when there is a rest", () => {
    renderDialog({ remaining: 0 });

    expect(screen.queryByTestId("manual-installer-use-for-all")).not.toBeInTheDocument();
  });

  it("offers to skip the top folder only when the archive has one", () => {
    renderDialog({ topFolder: undefined });

    expect(screen.queryByTestId("manual-installer-skip-top-folder")).not.toBeInTheDocument();
  });

  it("answers undefined when cancelled", async () => {
    const user = userEvent.setup();
    const { onAnswer } = renderDialog();

    await user.click(screen.getByTestId("manual-installer-cancel"));

    expect(onAnswer).toHaveBeenCalledWith("request", undefined);
  });

  it("marks a file another mod deployed as conflicting, and one of the mod's own as its", async () => {
    const own = VortexModStagingFolder("own-mod");
    renderDialog(
      { ownStagingFolders: [own], files: [file("new.dll"), file("Game.esm")] },
      vi.fn().mockResolvedValue(
        manifest([
          { relPath: "new.dll", source: "other-mod", time: 0 },
          { relPath: "Game.esm", source: own, time: 0 },
        ]),
      ),
    );

    const result = screen.getByTestId("manual-installer-result");
    const row = (name: string) =>
      within(result)
        .getAllByRole("listitem")
        .find((element) => element.textContent?.includes(name));

    await waitFor(() => expect(row("new.dll")).toHaveAttribute("data-status", "conflictsWithMod"));

    expect(row("Game.esm")).toHaveAttribute("data-status", "replacesOwnFile");
  });

  it("loads what is deployed once for the game", async () => {
    const { loadManifest } = renderDialog();

    await waitFor(() => expect(loadManifest).toHaveBeenCalledTimes(1));

    expect(loadManifest).toHaveBeenCalledWith("game");
  });

  it("still shows the result when what is deployed can't be loaded", async () => {
    renderDialog({}, vi.fn().mockRejectedValue(new Error("unreadable")));

    const result = screen.getByTestId("manual-installer-result");

    await waitFor(() =>
      expect(within(result).getAllByRole("listitem")[0]).toHaveAttribute("data-status", "new"),
    );

    expect(screen.getByTestId("manual-installer-incomplete")).toBeInTheDocument();
  });

  it("keeps the dialog open from one request to the next, with a fresh form", async () => {
    const user = userEvent.setup();
    const props = {
      loadManifest: vi.fn().mockResolvedValue(manifest()),
      modNames: new Map<VortexModStagingFolder, string>(),
      onAnswer: vi.fn(),
    };

    const { rerender } = render(<ManualInstallerDialog {...props} request={request()} visible />);

    await user.click(screen.getByTestId("manual-installer-skip-top-folder"));
    const dialog = screen.getByRole("dialog");

    rerender(<ManualInstallerDialog {...props} request={request({ id: "next" })} visible />);

    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(screen.getByTestId("manual-installer-skip-top-folder")).not.toBeChecked();
  });
});
