import { relativePath, type RelativePath } from "@nexusmods/paths";
import type { VortexModStagingFolder } from "@vortex/shared";
import type { QualifiedPath } from "@vortex/shared/filesystem";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { log } from "@/logging";
import type { FileTreeEntry } from "@/ui/components/file_tree/buildTree";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

import { finalPath } from "../manualInstaller";
import {
  classifyDestinationFiles,
  existingGameFiles,
  type DestinationFileStatus,
} from "../util/destinationConflicts";

export interface IManualInstallerResultProps {
  /** Every entry of the archive, directories included. */
  files: readonly FileTreeEntry[];
  /** The folder the files go in, relative to the game root; empty for the game root itself. */
  folder: string;
  /** The game's folder, if it's known. */
  gameFolder: QualifiedPath | undefined;
  /** The mod behind each staging folder, to name the mod a file conflicts with. */
  modNames: ReadonlyMap<VortexModStagingFolder, string>;
  skipTopFolder: boolean;
  /** The files other mods have deployed, by path; undefined until they are known. */
  deployed: ReadonlyMap<string, VortexModStagingFolder> | undefined;
}

const NO_FILES: ReadonlySet<string> = new Set();

const statusClassNames: { [kind in DestinationFileStatus["kind"]]: string } = {
  new: "text-neutral-subdued",
  replacesGameFile: "text-info-strong",
  conflictsWithMod: "text-danger-strong",
};

/**
 * Every file of the archive at the path it ends up at, each marked as new, replacing a file of the
 * game, or conflicting with a file of another mod.
 */
export const ManualInstallerResult = ({
  deployed,
  files,
  folder,
  gameFolder,
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

  // Kept with the paths it was read for, so a result for other paths is never used.
  const [read, setRead] = useState<{ paths: RelativePath[]; files: Set<string> }>();

  useEffect(() => {
    if (gameFolder === undefined) {
      return undefined;
    }

    let isCancelled = false;

    existingGameFiles(gameFolder, finalPaths)
      .catch((err: unknown) => {
        log("warn", "failed to read the game folder for the install result", { err });
        return new Set<string>();
      })
      .then((found) => {
        if (!isCancelled) {
          setRead({ paths: finalPaths, files: found });
        }
      })
      .catch(() => undefined);

    return () => {
      isCancelled = true;
    };
  }, [gameFolder, finalPaths]);

  // without a game folder there is nothing to replace
  let existing: ReadonlySet<string> | undefined = NO_FILES;

  if (gameFolder !== undefined) {
    existing = read?.paths === finalPaths ? read.files : undefined;
  }

  const results = useMemo(
    () =>
      deployed !== undefined && existing !== undefined
        ? classifyDestinationFiles(finalPaths, existing, deployed)
        : undefined,
    [finalPaths, existing, deployed],
  );

  const statusLabel = (status: DestinationFileStatus): string => {
    switch (status.kind) {
      case "new":
        return t("manualInstaller::statusNew");
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

      <Typography
        as="ul"
        className="mt-1 max-h-48 overflow-y-auto"
        data-testid="manual-installer-result"
        typographyType="body-sm"
      >
        {finalPaths.map((finalFilePath, index) => {
          const status = results?.[index]?.status;

          return (
            <li
              className="flex justify-between gap-x-4"
              data-status={status?.kind}
              key={finalFilePath}
            >
              <span className="truncate">{finalFilePath}</span>

              {status !== undefined && (
                <span className={joinClasses(["shrink-0", statusClassNames[status.kind]])}>
                  {statusLabel(status)}
                </span>
              )}
            </li>
          );
        })}
      </Typography>
    </div>
  );
};
