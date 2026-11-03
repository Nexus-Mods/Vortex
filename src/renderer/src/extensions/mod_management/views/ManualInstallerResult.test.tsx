import { relativePath } from "@nexusmods/paths";
import { render, screen, waitFor, within } from "@testing-library/react";
import { VortexModStagingFolder } from "@vortex/shared";
import { QualifiedPath } from "@vortex/shared/filesystem";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installInMemoryFS } from "@/test-utils/fsApi";
import type { FileTreeEntry } from "@/ui/components/file_tree/buildTree";

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

const deployedByOther = new Map([["shared.esp", otherMod]]);

const renderResult = (props: Partial<IManualInstallerResultProps> = {}) =>
  render(
    <ManualInstallerResult
      deployed={deployedByOther}
      files={files}
      folder=""
      gameFolder={gameFolder}
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

  beforeEach(() => {
    restore = installInMemoryFS((builder) => {
      builder.file(gameFolder.join("Game.esm"), text);
      builder.file(gameFolder.join("shared.esp"), text);
      builder.file(gameFolder.join("Mods", "Game.esm"), text);
    }).restore;
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
        modNames={noMods}
        skipTopFolder
      />,
    );

    await waitFor(() => expect(rowFor("Game.esm")).toHaveAttribute("data-status", "new"));
  });
});
