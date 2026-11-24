/**
 * File Tree Demo Component
 * Demonstrates the FileTree component: a tree built from a file list, and a lazily loaded one
 * whose selection the parent checks
 */

import { relativePath, type RelativePath } from "@nexusmods/paths";
import React, { useRef, useState } from "react";

import { Typography } from "@/ui/components/typography/Typography";

import { buildFileTree, type FileTreeEntry } from "./buildTree";
import { FileTree } from "./FileTree";
import type { IFileTreeNode } from "./types";

const toEntry = (raw: string): FileTreeEntry => ({
  path: relativePath(raw),
  kind: raw.endsWith("/") ? "directory" : "file",
});

const archiveTree = buildFileTree(
  [
    "Data/Textures/armor.dds",
    "Data/Textures/sky.dds",
    "Data/Meshes/armor.nif",
    "Data/Scripts/",
    "Data/MyMod.esp",
    "readme.txt",
    "changelog.txt",
  ].map(toEntry),
);

// What the lazy tree's "game folder" holds, which it only reads a directory at a time.
const gameEntries = [
  "Data/",
  "Data/Textures/",
  "Data/Meshes/",
  "Data/Game.esm",
  "Mods/",
  "Mods/Broken/",
  "Mods/Lighting/",
  "Mods/Lighting/lights.esp",
  "Mods/Lighting/lights.ini",
  "Game.exe",
  "Game.ini",
  "Data/Textures/stone.dds",
  "Data/Meshes/stone.nif",
  "Mods/Broken/broken.esp",
].map(toEntry);

const childrenOf = (parent: RelativePath | ""): IFileTreeNode[] =>
  gameEntries
    .filter(({ path }) =>
      parent === ""
        ? !path.includes("/")
        : path.startsWith(`${parent}/`) && !path.slice(parent.length + 1).includes("/"),
    )
    .map(({ path, kind }) => ({ path, kind }));

const withChildren = (
  nodes: IFileTreeNode[],
  parent: RelativePath,
  children: IFileTreeNode[],
): IFileTreeNode[] =>
  nodes.map((node) => {
    if (node.path === parent) {
      return { ...node, children };
    }

    if (node.children !== undefined && parent.startsWith(`${node.path}/`)) {
      return { ...node, children: withChildren(node.children, parent, children) };
    }

    return node;
  });

export const FileTreeDemo = () => {
  const [archiveExpanded, setArchiveExpanded] = useState<ReadonlySet<RelativePath>>(
    new Set([relativePath("Data")]),
  );
  const [archiveSelectedPath, setArchiveSelectedPath] = useState<RelativePath>();

  const [gameNodes, setGameNodes] = useState(() => childrenOf(""));
  const [gameExpanded, setGameExpanded] = useState<ReadonlySet<RelativePath>>(new Set());
  const [gameSelected, setGameSelected] = useState<IFileTreeNode>();

  const hasFailedOnce = useRef(false);

  const loadGameChildren = (node: IFileTreeNode): Promise<void> => {
    // Fails the first time, to show the error and that opening it again retries
    if (node.path === "Mods/Broken" && !hasFailedOnce.current) {
      hasFailedOnce.current = true;
      return Promise.reject(new Error("Couldn't read the directory"));
    }

    setGameNodes((current) => withChildren(current, node.path, childrenOf(node.path)));

    return Promise.resolve();
  };

  return (
    <div className="space-y-8">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h2" typographyType="heading-sm">
          File tree
        </Typography>

        <Typography appearance="subdued">
          A tree of files and directories. It takes its nodes, which directories are open and which
          node is selected from its parent, so the parent decides how they are built and stored.
          Opening a directory and selecting a node are separate: the arrow (or the Left and Right
          keys) opens and closes a directory. Any node can be selected, by a click or by moving to
          it with the arrow keys, Home or End.
        </Typography>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          From a file list
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          Built with buildFileTree from a list of paths, as for an archive. Directories known to be
          empty have no arrow.
        </Typography>

        <div className="max-w-md rounded-sm bg-surface-mid p-2">
          <FileTree
            aria-label="Archive"
            expandedPaths={archiveExpanded}
            nodes={archiveTree}
            selectedPath={archiveSelectedPath}
            onExpandedChange={setArchiveExpanded}
            onSelect={({ path }) => setArchiveSelectedPath(path)}
          />
        </div>

        <Typography appearance="subdued" typographyType="body-sm">
          Selected: {archiveSelectedPath ?? "nothing"}
        </Typography>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Loaded as it opens, with the selection checked by the parent
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          Each directory is read when first opened. Mods/Broken fails the first time you open it;
          opening it again retries. Anything under Mods is styled differently, as files from other
          mods would be. The tree lets any node be selected, and this page decides that only a
          directory is a valid destination.
        </Typography>

        <div className="max-w-md rounded-sm bg-surface-mid p-2">
          <FileTree
            aria-label="Game folder"
            expandedPaths={gameExpanded}
            nodes={gameNodes}
            selectedPath={gameSelected?.path}
            getNodeClassName={({ path }) =>
              path.startsWith("Mods/") ? "text-info-strong italic" : undefined
            }
            onExpandedChange={setGameExpanded}
            onLoadChildren={loadGameChildren}
            onSelect={setGameSelected}
          />
        </div>

        <Typography appearance="subdued" typographyType="body-sm">
          Selected: {gameSelected?.path ?? "nothing"}. Valid destination:{" "}
          {gameSelected?.kind === "directory" ? "yes" : "no"}
        </Typography>
      </div>
    </div>
  );
};
