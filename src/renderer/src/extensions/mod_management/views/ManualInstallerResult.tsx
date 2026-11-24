import { relativePath, type RelativePath } from "@nexusmods/paths";
import type { VortexModStagingFolder } from "@vortex/shared";
import type { QualifiedPath } from "@vortex/shared/filesystem";
import React, { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { log } from "@/logging";
import { Alert } from "@/ui/components/alert/Alert";
import type { FileTreeEntry } from "@/ui/components/file_tree/buildTree";
import { useTableVirtualizer } from "@/ui/components/table/useTableVirtualizer.hook";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

import { finalPath } from "../manualInstaller";
import {
  classifyDestinationFiles,
  cachedGameFiles,
  createDirectoryReader,
  existingGameFiles,
  type DestinationFileStatus,
  type IDeployedFiles,
  type IExistingGameFiles,
} from "../util/destinationConflicts";

export interface IManualInstallerResultProps {
  /** Every entry of the archive, directories included. */
  files: readonly FileTreeEntry[];
  /** The folder the files go in, relative to the game root; empty for the game root itself. */
  folder: string;
  /** The game's folder, if it's known. */
  gameFolder: QualifiedPath | undefined;
  /** What other mods deployed couldn't be read, so a conflict with one may not show. */
  hasDeployedFailed: boolean;
  /** The mod behind each staging folder, to name the mod a file conflicts with. */
  modNames: ReadonlyMap<VortexModStagingFolder, string>;
  skipTopFolder: boolean;
  /** The files mods have deployed, by path; undefined until they are known. */
  deployed: IDeployedFiles | undefined;
}

/** The height of a row of the list, which the virtualiser takes as exact. */
const ROW_HEIGHT = 24;

const NO_FILES: ReadonlySet<string> = new Set();

const statusClassNames: { [kind in DestinationFileStatus["kind"]]: string } = {
  new: "text-neutral-subdued",
  replacesOwnFile: "text-neutral-moderate",
  replacesGameFile: "text-info-strong",
  conflictsWithMod: "text-danger-strong",
};

/** Stands in for rows out of view, at their height, so the scroller keeps its full length. */
const Spacer = ({ height }: { height: number }) =>
  height ? <li aria-hidden={true} role="presentation" style={{ height: `${height}px` }} /> : null;

/**
 * Every file of the archive at the path it ends up at, each marked as new, replacing a file of the
 * game or one the mod deployed before, or conflicting with a file of another mod. Only the rows in
 * view are rendered, as an archive can have thousands of files.
 */
export const ManualInstallerResult = ({
  deployed,
  files,
  folder,
  gameFolder,
  hasDeployedFailed,
  modNames,
  skipTopFolder,
}: IManualInstallerResultProps) => {
  const { t } = useTranslation("mod_management");

  const finalPaths = useMemo(
    () =>
      files
        .filter(({ kind }) => kind === "file")
        .map(({ path }) => relativePath(finalPath(folder, path, skipTopFolder))),
    [files, folder, skipTopFolder],
  );

  // Each directory is read once while the dialog is open, however often the paths change, and
  // the reads of overlapping checks share one limit on how many run at once.
  const [reader] = useState(createDirectoryReader);

  // Kept with the paths it was read for, as only a read of the current paths is used.
  const [read, setRead] = useState<{ paths: RelativePath[]; found: IExistingGameFiles }>();

  // What was found for these paths already, when each of their directories has been read before,
  // so going back to a folder shows its statuses at once rather than checking again.
  const cached = useMemo(
    () => (gameFolder === undefined ? undefined : cachedGameFiles(finalPaths, reader)),
    [gameFolder, finalPaths, reader],
  );

  useEffect(() => {
    if (gameFolder === undefined || cached !== undefined) {
      return undefined;
    }

    let isCancelled = false;

    existingGameFiles(gameFolder, finalPaths, reader)
      .then((found) => {
        if (!isCancelled) {
          setRead({ paths: finalPaths, found });
        }
      })
      .catch((err: unknown) => {
        log("warn", "failed to read the game folder for the install result", { err });
        if (!isCancelled) {
          setRead({ paths: finalPaths, found: { files: new Set(), hasFailed: true } });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [gameFolder, finalPaths, reader, cached]);

  // A read of earlier paths would mark the current ones by the wrong directories, so the
  // statuses come only from what was found for these: at once when their directories were all
  // read before, else once they are. Without a game folder there is nothing to replace.
  const currentRead = read?.paths === finalPaths ? read.found : cached;
  const existing: ReadonlySet<string> | undefined =
    gameFolder === undefined ? NO_FILES : currentRead?.files;
  const isIncomplete = hasDeployedFailed || currentRead?.hasFailed === true;

  const results = useMemo(
    () =>
      deployed !== undefined && existing !== undefined
        ? classifyDestinationFiles(finalPaths, existing, deployed)
        : undefined,
    [finalPaths, existing, deployed],
  );

  const virtual = useTableVirtualizer({
    count: finalPaths.length,
    getItemKey: (index) => finalPaths[index] ?? String(index),
    getItemSize: () => ROW_HEIGHT,
  });

  const statusLabel = (status: DestinationFileStatus): string => {
    switch (status.kind) {
      case "new":
        return t("manualInstaller::statusNew");
      case "replacesOwnFile":
        return t("manualInstaller::statusReplacesOwnFile");
      case "replacesGameFile":
        return t("manualInstaller::statusReplacesGameFile");
      case "conflictsWithMod":
        return t("manualInstaller::statusConflictsWithMod", {
          mod: modNames.get(status.stagingFolder) ?? status.stagingFolder,
        });
    }
  };

  return (
    <div>
      <Typography appearance="subdued" as="p" typographyType="body-sm">
        {results === undefined ? t("manualInstaller::checking") : t("manualInstaller::result")}
      </Typography>

      {isIncomplete && (
        <Alert className="mt-1" data-testid="manual-installer-incomplete" severity="warning">
          {t("manualInstaller::statusIncomplete")}
        </Alert>
      )}

      {/* the scroller the virtualiser finds, as the nearest scrolling ancestor of the list */}
      <div className="mt-1 max-h-48 overflow-y-auto">
        <div ref={virtual.tableRef}>
          {/* Always rendered, at the top of the rows: where the virtualiser measures from. */}
          <div ref={virtual.startRef} role="presentation" />

          <Typography as="ul" data-testid="manual-installer-result" typographyType="body-sm">
            {virtual.items.map(({ gap, index }) => {
              const finalFilePath = finalPaths[index];
              const status = results?.[index]?.status;

              return (
                <Fragment key={finalFilePath}>
                  <Spacer height={gap} />

                  <li
                    className="flex items-center justify-between gap-x-4"
                    data-status={status?.kind}
                    style={{ height: `${ROW_HEIGHT}px` }}
                  >
                    <span className="truncate">{finalFilePath}</span>

                    {status !== undefined && (
                      <span className={joinClasses(["shrink-0", statusClassNames[status.kind]])}>
                        {statusLabel(status)}
                      </span>
                    )}
                  </li>
                </Fragment>
              );
            })}

            <Spacer height={virtual.endGap} />
          </Typography>
        </div>
      </div>
    </div>
  );
};
