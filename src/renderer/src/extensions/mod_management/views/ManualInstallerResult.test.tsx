import { relativePath } from "@nexusmods/paths";
import { render, screen, waitFor, within } from "@testing-library/react";
import { VortexModStagingFolder } from "@vortex/shared";
import { type InMemoryFS, QualifiedPath } from "@vortex/shared/filesystem";
import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installInMemoryFS } from "@/test-utils/fsApi";
import type { FileTreeEntry } from "@/ui/components/file_tree/buildTree";

import type { IDeployedFiles } from "../util/destinationConflicts";
import { ManualInstallerResult, type IManualInstallerResultProps } from "./ManualInstallerResult";

// --- Helpers ---

const gameFolder = QualifiedPath.fromNative("/game");

const text = { type: "text", data: "x" } as const;

const file = (path: string): FileTreeEntry => ({ path: relativePath(path), kind: "file" });

const directory = (path: string): FileTreeEntry => ({
  path: relativePath(path),
  kind: "directory",
});

const files = [directory("Top"), file("Top/new.dll"), file("Top/Game.esm"), file("Top/shared.esp")];

const noMods = new Map<VortexModStagingFolder, string>();

const otherMod = VortexModStagingFolder("other-mod");

const deployedByOther: IDeployedFiles = {
  byOtherMods: new Map([["shared.esp", otherMod]]),
  byOwnMod: new Set(),
};

const renderResult = (props: Partial<IManualInstallerResultProps> = {}) =>
  render(
    <ManualInstallerResult
      deployed={deployedByOther}
      files={files}
      folder=""
      gameFolder={gameFolder}
      hasDeployedFailed={false}
      modNames={noMods}
      skipTopFolder={false}
      {...props}
    />,
  );

const list = () => screen.getByTestId("manual-installer-result");

const rows = () => within(list()).getAllByRole("listitem");

const rowFor = (finalPath: string): HTMLElement => {
  const row = rows().find((element) => element.textContent?.includes(finalPath));

  if (row === undefined) {
    throw new Error(`No row for "${finalPath}"`);
  }

  return row;
};

describe("ManualInstallerResult", () => {
  let restore: () => void;
  let fs: InMemoryFS;

  beforeEach(() => {
    const installed = installInMemoryFS((builder) => {
      builder.file(gameFolder.join("Game.esm"), text);
      builder.file(gameFolder.join("shared.esp"), text);
      builder.file(gameFolder.join("bin"), text);
      builder.file(gameFolder.join("Mods", "Game.esm"), text);
    });

    restore = installed.restore;
    fs = installed.fs;
  });

  afterEach(() => {
    restore();
  });

  it("lists each file of the archive but not its directories", () => {
    renderResult({ skipTopFolder: false });

    expect(rows()).toHaveLength(3);
  });

  it("shows each file at the path it ends up at", () => {
    renderResult({ folder: "Mods" });

    expect(rowFor("Mods/Top/new.dll")).toBeInTheDocument();
  });

  it("leaves out the top folder when skipping it", () => {
    renderResult({ skipTopFolder: true });

    expect(rowFor("new.dll").textContent).not.toContain("Top");
  });

  it("marks files as new, replacing a game file, or conflicting with another mod", async () => {
    renderResult({ skipTopFolder: true });

    await waitFor(() => expect(rowFor("new.dll")).toHaveAttribute("data-status", "new"));

    expect(rowFor("Game.esm")).toHaveAttribute("data-status", "replacesGameFile");
    expect(rowFor("shared.esp")).toHaveAttribute("data-status", "conflictsWithMod");
  });

  it("marks a file the mod itself deployed before as replacing its own, not the game's", async () => {
    // on a reinstall, the previous version's deployed file is in the game folder too
    renderResult({
      deployed: { byOtherMods: new Map(), byOwnMod: new Set(["game.esm"]) },
      skipTopFolder: true,
    });

    await waitFor(() =>
      expect(rowFor("Game.esm")).toHaveAttribute("data-status", "replacesOwnFile"),
    );

    expect(rowFor("Game.esm")).toHaveTextContent("manualInstaller::statusReplacesOwnFile");
    expect(rowFor("new.dll")).toHaveAttribute("data-status", "new");
  });

  it("compares paths without regard to case", async () => {
    renderResult({ files: [file("SHARED.ESP"), file("GAME.ESM")] });

    await waitFor(() =>
      expect(rowFor("GAME.ESM")).toHaveAttribute("data-status", "replacesGameFile"),
    );

    expect(rowFor("SHARED.ESP")).toHaveAttribute("data-status", "conflictsWithMod");
  });

  it("marks nothing until what other mods deployed is known", async () => {
    renderResult({ deployed: undefined, skipTopFolder: true });

    // let the read of the game folder finish
    await new Promise((resolve) => setTimeout(resolve, 20));

    for (const row of rows()) {
      expect(row).not.toHaveAttribute("data-status");
    }
  });

  it("marks everything not deployed by another mod as new without a game folder", async () => {
    renderResult({ gameFolder: undefined, skipTopFolder: true });

    await waitFor(() => expect(rowFor("Game.esm")).toHaveAttribute("data-status", "new"));

    expect(rowFor("shared.esp")).toHaveAttribute("data-status", "conflictsWithMod");
  });

  it("marks the files again for another folder", async () => {
    const { rerender } = renderResult({ skipTopFolder: true });

    await waitFor(() =>
      expect(rowFor("Game.esm")).toHaveAttribute("data-status", "replacesGameFile"),
    );

    rerender(
      <ManualInstallerResult
        deployed={deployedByOther}
        files={files}
        folder="Elsewhere"
        gameFolder={gameFolder}
        hasDeployedFailed={false}
        modNames={noMods}
        skipTopFolder
      />,
    );

    await waitFor(() => expect(rowFor("Game.esm")).toHaveAttribute("data-status", "new"));
  });

  it("marks nothing for another folder until its directories are read", async () => {
    const { rerender } = renderResult({ skipTopFolder: true });

    await waitFor(() =>
      expect(rowFor("Game.esm")).toHaveAttribute("data-status", "replacesGameFile"),
    );

    rerender(
      <ManualInstallerResult
        deployed={deployedByOther}
        files={files}
        folder="Mods"
        gameFolder={gameFolder}
        hasDeployedFailed={false}
        modNames={noMods}
        skipTopFolder
      />,
    );

    // the read of Mods can't be done yet, and the game root's says nothing about it
    for (const row of rows()) {
      expect(row).not.toHaveAttribute("data-status");
    }
    expect(screen.getByText("manualInstaller::checking")).toBeInTheDocument();

    await waitFor(() =>
      expect(rowFor("Mods/Game.esm")).toHaveAttribute("data-status", "replacesGameFile"),
    );
    expect(rowFor("Mods/new.dll")).toHaveAttribute("data-status", "new");
  });

  it("reads a directory it has read before not again", async () => {
    const { rerender } = renderResult({ skipTopFolder: true });

    await waitFor(() =>
      expect(rowFor("Game.esm")).toHaveAttribute("data-status", "replacesGameFile"),
    );

    // added after the game root was read, so only a new read of it finds this
    await fs.writeFile(gameFolder.join("new.dll"), new TextEncoder().encode("x"));

    const reresult = (skipTopFolder: boolean) => (
      <ManualInstallerResult
        deployed={deployedByOther}
        files={files}
        folder=""
        gameFolder={gameFolder}
        hasDeployedFailed={false}
        modNames={noMods}
        skipTopFolder={skipTopFolder}
      />
    );

    rerender(reresult(false));
    await waitFor(() => expect(rowFor("Top/Game.esm")).toHaveAttribute("data-status", "new"));

    rerender(reresult(true));
    await waitFor(() =>
      expect(rowFor("Game.esm")).toHaveAttribute("data-status", "replacesGameFile"),
    );

    // the game root as it was first read
    expect(rowFor("new.dll")).toHaveAttribute("data-status", "new");
  });

  it("marks the files at once for a folder whose directories were all read before", async () => {
    const reresult = (folder: string) => (
      <ManualInstallerResult
        deployed={deployedByOther}
        files={files}
        folder={folder}
        gameFolder={gameFolder}
        hasDeployedFailed={false}
        modNames={noMods}
        skipTopFolder
      />
    );

    const { rerender } = render(reresult(""));

    await waitFor(() =>
      expect(rowFor("Game.esm")).toHaveAttribute("data-status", "replacesGameFile"),
    );

    rerender(reresult("Mods"));
    await waitFor(() =>
      expect(rowFor("Mods/Game.esm")).toHaveAttribute("data-status", "replacesGameFile"),
    );

    // back to the game root, read before: marked in the same render, with nothing to wait for
    rerender(reresult(""));

    expect(rowFor("Game.esm")).toHaveAttribute("data-status", "replacesGameFile");
    expect(rowFor("new.dll")).toHaveAttribute("data-status", "new");
    expect(screen.queryByText("manualInstaller::checking")).not.toBeInTheDocument();
  });

  it("tells that the marks may be wrong when a directory can't be read", async () => {
    // the game has a file where the mod has a directory, which can't be read as one
    renderResult({ files: [file("bin/mod.dll"), file("Game.esm")] });

    expect(await screen.findByTestId("manual-installer-incomplete")).toBeInTheDocument();
    // the directories that could be read are still checked
    expect(rowFor("Game.esm")).toHaveAttribute("data-status", "replacesGameFile");
  });

  it("tells that the marks may be wrong when what other mods deployed can't be read", () => {
    renderResult({ hasDeployedFailed: true });

    expect(screen.getByTestId("manual-installer-incomplete")).toBeInTheDocument();
  });

  it("doesn't tell the marks may be wrong when everything could be read", async () => {
    renderResult({ skipTopFolder: true });

    await waitFor(() => expect(rowFor("new.dll")).toHaveAttribute("data-status", "new"));

    expect(screen.queryByTestId("manual-installer-incomplete")).not.toBeInTheDocument();
  });
});
