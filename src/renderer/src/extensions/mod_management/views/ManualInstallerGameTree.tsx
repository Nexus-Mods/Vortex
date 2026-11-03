import { relativePath, type RelativePath } from "@nexusmods/paths";
import type { VortexModStagingFolder } from "@vortex/shared";
import type { QualifiedPath } from "@vortex/shared/filesystem";
import React, { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { log } from "@/logging";
import {
  ContextMenu,
  contextMenuPosition,
  type IContextMenuPosition,
} from "@/ui/components/context_menu/ContextMenu";
import type { FileTreeEntry } from "@/ui/components/file_tree/buildTree";
import { FileTree } from "@/ui/components/file_tree/FileTree";
import { findNode } from "@/ui/components/file_tree/findNode";
import {
  fileTreeNodeName,
  parentPath,
  pathName,
  type IFileTreeNode,
} from "@/ui/components/file_tree/types";
import { childNodes, withChildren } from "@/ui/components/file_tree/withChildren";
import { withEmptyDirectories } from "@/ui/components/file_tree/withEmptyDirectories";
import { PopoverMenu } from "@/ui/components/popover/popover_menu/PopoverMenu";
import { Typography } from "@/ui/components/typography/Typography";

import { readFileTreeDirectory } from "../util/fileTree";
import { uniqueFolderName } from "../util/newFolder";
import { ManualInstallerFolderNameInput } from "./ManualInstallerFolderNameInput";

export interface IManualInstallerGameTreeProps {
  /** Directories to show that don't exist yet, which the install will create. */
  created: readonly RelativePath[];
  /** The files other mods have deployed, by path; they are shown apart from the game's own. */
  deployed: ReadonlyMap<string, VortexModStagingFolder> | undefined;
  /** The folder the files go in, relative to the game root; empty for the game root itself. */
  folder: string;
  /** The game's folder, if it's known. */
  gameFolder: QualifiedPath | undefined;
  /** The node selected in the tree, if it was one of the tree's. */
  selectedNode: IFileTreeNode | undefined;
  /** Adds, renames or removes the directories to create, from the ones there are by then. */
  onCreatedChange: (update: (created: RelativePath[]) => RelativePath[]) => void;
  /** A folder is being named, or isn't any more. */
  onNamingChange: (isNaming: boolean) => void;
  /** Selects a node of the tree. */
  onSelect: (node: IFileTreeNode) => void;
}

/** The game folder itself, the one node at the top of the tree. */
const ROOT = relativePath("");

function childPath(parent: RelativePath, name: string): RelativePath {
  return relativePath(parent === ROOT ? name : `${parent}/${name}`);
}

/**
 * Reads the top level of the game folder, and the directories on the way to `folder` so that it
 * shows. The directories on the way that don't exist are left out, as is `folder` itself.
 */
async function loadInitialTree(
  gameFolder: QualifiedPath,
  folder: string,
): Promise<{ nodes: IFileTreeNode[]; expanded: Set<RelativePath> }> {
  let nodes = childNodes(ROOT, await readFileTreeDirectory(gameFolder));
  const expanded = new Set<RelativePath>([ROOT]);

  const segments = folder === "" ? [] : relativePath(folder).split("/");

  for (let depth = 1; depth < segments.length; depth++) {
    const node = findNode(nodes, relativePath(segments.slice(0, depth).join("/")));

    if (node === undefined || node.kind === "file") {
      break;
    }

    nodes = withChildren(nodes, node.path, await readFileTreeDirectory(gameFolder, node.path));
    expanded.add(node.path);
  }

  return { nodes, expanded };
}

/**
 * The game folder as a tree of what it holds, read as directories are opened, to pick the
 * folder the files go in. A right-click makes a new folder in a directory, named in place.
 */
export const ManualInstallerGameTree = ({
  created,
  deployed,
  folder,
  gameFolder,
  selectedNode,
  onCreatedChange,
  onNamingChange,
  onSelect,
}: IManualInstallerGameTreeProps) => {
  const { t } = useTranslation("mod_management");

  // The folder to reveal is the one the dialog opened with, not each one picked since.
  const [initialFolder] = useState(folder);
  const [nodes, setNodes] = useState<IFileTreeNode[]>([]);
  const [expanded, setExpanded] = useState<ReadonlySet<RelativePath>>(new Set([ROOT]));
  const [hasFailed, setHasFailed] = useState(false);
  const [menu, setMenu] = useState<{ node: IFileTreeNode; position: IContextMenuPosition }>();
  const [renamingPath, setRenamingPath] = useState<RelativePath>();

  // what is created by the time a read finishes, not by the time it started
  const latestCreated = useRef(created);

  useEffect(() => {
    latestCreated.current = created;
  }, [created]);

  const isNaming = renamingPath !== undefined;

  useEffect(() => {
    onNamingChange(isNaming);
  }, [isNaming, onNamingChange]);

  useEffect(() => {
    if (gameFolder === undefined) {
      return undefined;
    }

    let isCancelled = false;

    loadInitialTree(gameFolder, initialFolder)
      .then((loaded) => {
        if (!isCancelled) {
          setNodes(loaded.nodes);
          setExpanded(loaded.expanded);
        }
      })
      .catch((err: unknown) => {
        log("warn", "failed to read the game folder for the install destination", { err });
        if (!isCancelled) {
          setHasFailed(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [gameFolder, initialFolder]);

  const shownNodes = useMemo(() => withEmptyDirectories(nodes, created), [nodes, created]);

  const rootNode = useMemo(
    (): IFileTreeNode => ({ path: ROOT, kind: "directory", children: shownNodes }),
    [shownNodes],
  );

  const treeNodes = useMemo(() => [rootNode], [rootNode]);

  const directoryAt = (path: RelativePath): IFileTreeNode | undefined =>
    path === ROOT ? rootNode : findNode(shownNodes, path);

  const readChildren = async (node: IFileTreeNode): Promise<FileTreeEntry[]> => {
    if (gameFolder === undefined) {
      return [];
    }

    const entries = await readFileTreeDirectory(gameFolder, node.path);

    // the tree may have been read again meanwhile, without this directory
    setNodes((current) =>
      findNode(current, node.path) === undefined
        ? current
        : withChildren(current, node.path, entries),
    );

    return entries;
  };

  const createFolderIn = async (target: IFileTreeNode) => {
    const parentOfNew = target.kind === "directory" ? target.path : parentPath(target.path);
    const parent = directoryAt(parentOfNew);

    if (parent?.kind !== "directory") {
      return;
    }

    let names = (parent.children ?? []).map(fileTreeNodeName);

    if (parent.children === undefined) {
      // It's read before the new folder goes in, or the new folder would hide what it holds.
      try {
        names = (await readChildren(parent)).map(fileTreeNodeName);
      } catch (err) {
        log("warn", "failed to read a game directory to create a folder in", { err });
        return;
      }
    }

    names.push(
      ...latestCreated.current.filter((other) => parentPath(other) === parentOfNew).map(pathName),
    );

    const path = childPath(parentOfNew, uniqueFolderName(t("manualInstaller::newFolder"), names));

    setExpanded((current) => new Set(current).add(parentOfNew));
    onCreatedChange((current) => [...current, path]);
    setRenamingPath(path);
    onSelect({ path, kind: "directory", children: [] });
  };

  const commitName = (path: RelativePath, name: string) => {
    const renamed = childPath(parentPath(path), name);

    onCreatedChange((current) => current.map((other) => (other === path ? renamed : other)));
    setRenamingPath(undefined);
    onSelect({ path: renamed, kind: "directory", children: [] });
  };

  const cancelName = (path: RelativePath) => {
    onCreatedChange((current) => current.filter((other) => other !== path));
    setRenamingPath(undefined);
    onSelect(directoryAt(parentPath(path)) ?? rootNode);
  };

  const takenNames = (path: RelativePath): string[] =>
    (directoryAt(parentPath(path))?.children ?? [])
      .filter((sibling) => sibling.path !== path)
      .map(fileTreeNodeName);

  const openMenu = (node: IFileTreeNode, event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    onSelect(node);
    setMenu({ node, position: contextMenuPosition(event) });
  };

  let selectedPath = selectedNode?.path;

  if (selectedPath === undefined) {
    const folderPath = relativePath(folder);
    selectedPath = findNode(shownNodes, folderPath)?.path ?? folderPath;
  }

  return (
    <div className="flex min-h-0 flex-col gap-y-2">
      <Typography appearance="subdued" as="p" typographyType="body-sm">
        {t("manualInstaller::gameFolderTree")}
      </Typography>

      <div className="max-h-80 overflow-y-auto rounded-sm bg-surface-mid p-2">
        <FileTree
          aria-label={t("manualInstaller::gameFolderTree")}
          data-testid="manual-installer-game-tree"
          expandedPaths={expanded}
          getNodeClassName={({ kind, path }) =>
            kind === "file" && deployed?.has(path.toLowerCase()) === true
              ? "text-info-strong"
              : undefined
          }
          loadErrorMessage={t("manualInstaller::directoryFailed")}
          nodes={treeNodes}
          renderNode={(node) => {
            if (node.path === renamingPath) {
              return (
                <ManualInstallerFolderNameInput
                  initialName={fileTreeNodeName(node)}
                  takenNames={takenNames(node.path)}
                  onCancel={() => cancelName(node.path)}
                  onCommit={(name) => commitName(node.path, name)}
                />
              );
            }

            return node.path === ROOT ? (
              <span className="truncate">{t("manualInstaller::gameFolder")}</span>
            ) : undefined;
          }}
          selectedPath={selectedPath}
          onExpandedChange={setExpanded}
          onLoadChildren={async (node) => {
            await readChildren(node);
          }}
          onNodeContextMenu={openMenu}
          onSelect={onSelect}
        />
      </div>

      {gameFolder === undefined && (
        <Typography appearance="subdued" as="p" typographyType="body-sm">
          {t("manualInstaller::noGameFolder")}
        </Typography>
      )}

      {hasFailed && (
        <Typography appearance="subdued" as="p" typographyType="body-sm">
          {t("manualInstaller::gameFolderFailed")}
        </Typography>
      )}

      {/* the dialog is a modal, which a menu has to be raised above to show */}
      <ContextMenu
        className="z-modal-popover"
        position={menu?.position}
        onClose={() => setMenu(undefined)}
      >
        {(close) => (
          <PopoverMenu
            actions={[
              [
                {
                  label: t("manualInstaller::newFolder"),
                  icon: "create_new_folder",
                  onClick: () => {
                    if (menu !== undefined) {
                      void createFolderIn(menu.node);
                    }
                  },
                },
              ],
            ]}
            label={t("manualInstaller::newFolder")}
            onSelect={close}
          />
        )}
      </ContextMenu>
    </div>
  );
};
