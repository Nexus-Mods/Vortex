import { relativePath, type RelativePath } from "@nexusmods/paths";
import type { VortexGameId, VortexModStagingFolder } from "@vortex/shared";
import { QualifiedPath } from "@vortex/shared/filesystem";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { log } from "@/logging";
import { Alert } from "@/ui/components/alert/Alert";
import { Button } from "@/ui/components/button/Button";
import { buildFileTree } from "@/ui/components/file_tree/buildTree";
import { FileTree } from "@/ui/components/file_tree/FileTree";
import type { IFileTreeNode } from "@/ui/components/file_tree/types";
import { CheckboxField } from "@/ui/components/form/checkbox_field/CheckboxField";
import { ModalPanel, ModalWrapper } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";

import { normalizeDestination } from "../manualInstaller";
import type { IManualInstallerAnswer } from "../manualInstallerQueue";
import type { IManualInstallerRequest } from "../reducers/manualInstaller";
import type { IDeploymentManifest } from "../types/IDeploymentManifest";
import { deployedFiles, type IDeployedFiles } from "../util/destinationConflicts";
import { ManualInstallerGameTree } from "./ManualInstallerGameTree";
import { ManualInstallerResult } from "./ManualInstallerResult";

export interface IManualInstallerDialogProps {
  visible: boolean;
  /** the request to answer, the first of the queue */
  request: IManualInstallerRequest | undefined;
  /** the mod behind each staging folder, to name the mod a file conflicts with */
  modNames: ReadonlyMap<VortexModStagingFolder, string>;
  /** Loads what is deployed to the game. */
  loadManifest: (gameId: VortexGameId) => Promise<IDeploymentManifest>;
  /** Answers the request, undefined when the user cancelled. */
  onAnswer: (requestId: string, answer: IManualInstallerAnswer | undefined) => void;
}

interface IFormProps {
  loadManifest: IManualInstallerDialogProps["loadManifest"];
  modNames: IManualInstallerDialogProps["modNames"];
  request: IManualInstallerRequest;
  onAnswer: (answer: IManualInstallerAnswer | undefined) => void;
}

const NOTHING_DEPLOYED: IDeployedFiles = { byOtherMods: new Map(), byOwnMod: new Set() };

function toQualifiedPath(nativePath: string): QualifiedPath | undefined {
  if (nativePath === "") {
    return undefined;
  }

  try {
    return QualifiedPath.fromNative(nativePath);
  } catch (err) {
    log("warn", "the game folder isn't a usable path", { gameFolder: nativePath, err });
    return undefined;
  }
}

const ManualInstallerForm = ({ loadManifest, modNames, request, onAnswer }: IFormProps) => {
  const { t } = useTranslation("mod_management");

  // the folder is kept as the installer takes it; the trees use relative paths
  const [folder, setFolder] = useState(request.defaultFolder ?? "");
  // the default folder is shown even if the game doesn't have it, as it will be created
  const [created, setCreated] = useState<RelativePath[]>(
    request.defaultFolder ? [relativePath(request.defaultFolder)] : [],
  );
  const [selectedNode, setSelectedNode] = useState<IFileTreeNode>();
  const [skipTopFolder, setSkipTopFolder] = useState(false);
  const [useAsDefault, setUseAsDefault] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [useForAll, setUseForAll] = useState(false);
  const [deployed, setDeployed] = useState<IDeployedFiles>();
  const [hasDeployedFailed, setHasDeployedFailed] = useState(false);
  // a folder is being named; it's taken or dropped first, so that none is lost by a click
  const [isNaming, setIsNaming] = useState(false);

  const archiveTree = useMemo(() => buildFileTree(request.files), [request.files]);
  const [archiveExpanded, setArchiveExpanded] = useState<ReadonlySet<RelativePath>>(
    () => new Set(archiveTree.filter(({ kind }) => kind === "directory").map(({ path }) => path)),
  );

  const gameFolder = useMemo(() => toQualifiedPath(request.gameFolder), [request.gameFolder]);

  useEffect(() => {
    let isCancelled = false;

    loadManifest(request.gameId)
      .then((manifest) => deployedFiles(manifest, request.ownStagingFolders))
      .catch((err: unknown) => {
        log("warn", "failed to read what is deployed for the install destination", { err });
        if (!isCancelled) {
          setHasDeployedFailed(true);
        }
        return NOTHING_DEPLOYED;
      })
      .then((found) => {
        if (!isCancelled) {
          setDeployed(found);
        }
      })
      .catch(() => undefined);

    return () => {
      isCancelled = true;
    };
  }, [loadManifest, request.gameId, request.ownStagingFolders]);

  // the trees let any node be selected, but only a directory can be installed to
  const isTargetValid = selectedNode?.kind !== "file";
  const canInstall = isTargetValid && !isNaming;

  const selectNode = (node: IFileTreeNode) => {
    setSelectedNode(node);

    if (node.kind === "directory") {
      setFolder(normalizeDestination(node.path) ?? "");
    }
  };

  return (
    <ModalPanel
      className="flex max-h-[90vh] flex-col"
      title={t("manualInstaller::title")}
      onClose={() => onAnswer(undefined)}
    >
      <div className="min-h-0 space-y-4 overflow-y-auto">
        <Typography appearance="subdued" as="p" typographyType="body-sm">
          {t("manualInstaller::intro", { modName: request.modName })}
        </Typography>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex min-h-0 flex-col gap-y-2">
            <Typography appearance="subdued" as="p" typographyType="body-sm">
              {t("manualInstaller::modFiles")}
            </Typography>

            <div className="max-h-80 overflow-y-auto rounded-sm bg-surface-mid p-2">
              <FileTree
                aria-label={t("manualInstaller::modFiles")}
                data-testid="manual-installer-archive-tree"
                expandedPaths={archiveExpanded}
                nodes={archiveTree}
                onExpandedChange={setArchiveExpanded}
              />
            </div>

            {request.topFolder !== undefined && (
              <CheckboxField
                checked={skipTopFolder}
                data-testid="manual-installer-skip-top-folder"
                label={t("manualInstaller::skipTopFolder", { folder: request.topFolder })}
                onChange={setSkipTopFolder}
              />
            )}
          </div>

          <ManualInstallerGameTree
            created={created}
            deployed={deployed?.byOtherMods}
            folder={folder}
            gameFolder={gameFolder}
            selectedNode={selectedNode}
            onCreatedChange={setCreated}
            onNamingChange={setIsNaming}
            onSelect={selectNode}
          />
        </div>

        <ManualInstallerResult
          deployed={deployed}
          files={request.files}
          folder={folder}
          gameFolder={gameFolder}
          hasDeployedFailed={hasDeployedFailed}
          modNames={modNames}
          skipTopFolder={skipTopFolder}
        />

        <CheckboxField
          checked={useAsDefault}
          data-testid="manual-installer-use-as-default"
          label={t("manualInstaller::useAsDefault")}
          onChange={setUseAsDefault}
        />

        <CheckboxField
          checked={dontAskAgain}
          data-testid="manual-installer-dont-ask-again"
          label={t("manualInstaller::dontAskAgain")}
          onChange={setDontAskAgain}
        />

        {request.remaining > 0 && (
          <CheckboxField
            checked={useForAll}
            data-testid="manual-installer-use-for-all"
            label={t("manualInstaller::useForAll", { count: request.remaining })}
            onChange={setUseForAll}
          />
        )}
      </div>

      <div className="mt-4 flex shrink-0 flex-col gap-y-3">
        {/* by the button it explains, and out of the scrolling part so it can't be missed */}
        {!isTargetValid && (
          <Alert data-testid="manual-installer-select-directory" severity="warning">
            {t("manualInstaller::selectDirectory")}
          </Alert>
        )}

        <div className="flex justify-end gap-2">
          <Button
            appearance="subdued"
            brand="neutral"
            data-testid="manual-installer-cancel"
            onClick={() => onAnswer(undefined)}
          >
            {t("manualInstaller::cancel")}
          </Button>

          <Button
            data-testid="manual-installer-install"
            disabled={!canInstall}
            onClick={() =>
              onAnswer({
                folder,
                skipTopFolder,
                // not asking again only works with a default folder to skip to
                useAsDefault: useAsDefault || dontAskAgain,
                dontAskAgain,
                useForAll,
              })
            }
          >
            {t("manualInstaller::install")}
          </Button>
        </div>
      </div>
    </ModalPanel>
  );
};

export const ManualInstallerDialog = ({
  loadManifest,
  modNames,
  request,
  visible,
  onAnswer,
}: IManualInstallerDialogProps) =>
  request === undefined ? null : (
    // the modal stays as requests follow one another; only the form starts afresh
    <ModalWrapper isOpen={visible} size="xl" onClose={() => onAnswer(request.id, undefined)}>
      <ManualInstallerForm
        key={request.id}
        loadManifest={loadManifest}
        modNames={modNames}
        request={request}
        onAnswer={(answer) => onAnswer(request.id, answer)}
      />
    </ModalWrapper>
  );
