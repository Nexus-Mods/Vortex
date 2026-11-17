import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type OwnedModFile,
  ownedFileKey,
  removalCounts,
} from "@/extensions/browse_nexus/util/delete_mod_files/deleteModFiles";
import { Button } from "@/ui/components/button/Button";
import { CheckboxField } from "@/ui/components/form/checkbox_field/CheckboxField";
import { Modal } from "@/ui/components/modal/Modal";
import { Pill } from "@/ui/components/pill/Pill";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

interface IDeleteModFilesModalProps {
  /** The mod's name, for the description. */
  modName: string;
  /** The files the user has of the mod; unset, the modal isn't showing. */
  files?: OwnedModFile[];
  /** Removes the chosen files, deleting their downloads too when `deleteDownloads` is set. */
  onDelete: (files: OwnedModFile[], deleteDownloads: boolean) => void;
  /** Keeps them. */
  onClose: () => void;
}

interface IDeleteModFilesBodyProps extends Omit<IDeleteModFilesModalProps, "files"> {
  /** The files the user has of the mod. */
  files: OwnedModFile[];
}

/**
 * The modal's contents, mounted while it shows so each opening starts afresh: every file ticked
 * and downloads kept. With nothing installed there's only deleting, so it's forced on. Downloads
 * only count, and can only be changed, while their deletion is on; until then they show unticked.
 */
const DeleteModFilesBody = ({ modName, files, onDelete, onClose }: IDeleteModFilesBodyProps) => {
  const { t } = useTranslation();
  const isSingle = files.length === 1;
  const isDeleteForced = !files.some((file) => file.kind === "installed");
  const hasUninstalled = files.some((file) => file.kind === "downloaded");
  /** Whether any file has a download to delete; without one, the option would do nothing. */
  const hasDownloads = files.some((file) => file.kind === "downloaded" || file.hasDownload);
  const [deleteDownloads, setDeleteDownloads] = useState(isDeleteForced);
  const [chosen, setChosen] = useState(() => new Set(files.map(ownedFileKey)));
  const isSelectable = (file: OwnedModFile) => file.kind === "installed" || deleteDownloads;
  const chosenFiles = files.filter((file) => chosen.has(ownedFileKey(file)) && isSelectable(file));
  const missingCount = chosenFiles.filter(
    (file) => file.kind === "installed" && !file.hasDownload,
  ).length;
  const { deleted: deleteCount, uninstalled: uninstallCount } = removalCounts(
    chosenFiles,
    deleteDownloads,
  );
  const isPermanent = deleteCount > 0;

  /** What the user has of a file, as pills: installed, perhaps without its download, or not. */
  const pillsOf = (file: OwnedModFile) => {
    if (file.kind === "downloaded") {
      return <Pill>{t("Uninstalled")}</Pill>;
    }

    return (
      <>
        <Pill brand="success" icon="check_circle">
          {t("Installed")}
        </Pill>

        {!file.hasDownload && (
          <Pill brand="warning" icon="warning">
            {t("Download missing")}
          </Pill>
        )}
      </>
    );
  };

  /**
   * What deleting downloads costs, and, while it gates them, that it unlocks uninstalled files;
   * nothing when there's no download to delete, as the option is off then.
   */
  const downloadsHint = () => {
    if (!hasDownloads) {
      return undefined;
    }

    if (hasUninstalled && !isDeleteForced) {
      return t(
        "Reinstalling will mean downloading again. Uninstalled files can only be selected when this is ticked.",
      );
    }

    return t("Reinstalling will mean downloading again.");
  };

  /**
   * The main action's label: how many files are deleted, removing them or having no download to
   * keep, and how many uninstalled, keeping theirs to reinstall from; both when it's some of each.
   */
  const actionLabel = () => {
    if (isSingle) {
      return isPermanent ? t("Delete") : t("Uninstall");
    }

    if (deleteCount > 0 && uninstallCount > 0) {
      return t("{{deleting}}, {{uninstalling}}", {
        deleting: t("Delete {{count}} file", { count: deleteCount }),
        uninstalling: t("uninstall {{count}} file", { count: uninstallCount }),
      });
    }

    return isPermanent
      ? t("Delete {{count}} file", { count: deleteCount })
      : t("Uninstall {{count}} file", { count: uninstallCount });
  };

  return (
    <div className="space-y-4">
      <Typography
        appearance="subdued"
        data-testid="delete-mod-files-description"
        typographyType="body-sm"
      >
        {isSingle
          ? t("Remove {{file}} from your game", { file: files[0].name })
          : t("Choose which files to remove from {{mod}}", { mod: modName })}
      </Typography>

      <div className="space-y-3">
        {!isSingle && (
          <div className="max-h-[40vh] space-y-2 overflow-y-auto">
            {files.map((file) => (
              <div
                className="flex items-start justify-between gap-2"
                data-testid="delete-mod-files-row"
                key={ownedFileKey(file)}
              >
                <CheckboxField
                  checked={chosen.has(ownedFileKey(file)) && isSelectable(file)}
                  data-testid="delete-mod-files-file"
                  disabled={!isSelectable(file)}
                  fieldClassName="min-w-0 pt-0.5"
                  label={file.name}
                  onChange={(isChosen: boolean) => {
                    const next = new Set(chosen);

                    if (isChosen) {
                      next.add(ownedFileKey(file));
                    } else {
                      next.delete(ownedFileKey(file));
                    }

                    setChosen(next);
                  }}
                />

                <div
                  className={joinClasses(["flex shrink-0 gap-1"], {
                    "opacity-40": !isSelectable(file),
                  })}
                >
                  {pillsOf(file)}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="h-px bg-stroke-weak" />

        <div className="space-y-1">
          <CheckboxField
            checked={deleteDownloads}
            data-testid="delete-mod-files-downloads"
            disabled={isDeleteForced || !hasDownloads}
            hints={downloadsHint()}
            label={t("Also delete downloaded files")}
            onChange={setDeleteDownloads}
          />

          {missingCount > 0 && (
            <Typography
              brand="warning"
              className="pl-6"
              data-testid="delete-mod-files-missing-downloads"
              typographyType="body-sm"
            >
              {t("{{count}} file has no download to reinstall, so it can only be deleted.", {
                count: missingCount,
              })}
            </Typography>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          appearance="moderate"
          brand="neutral"
          data-testid="delete-mod-files-cancel"
          onClick={onClose}
        >
          {t("Cancel")}
        </Button>

        <Button
          brand={isPermanent ? "danger" : "neutral"}
          data-testid="delete-mod-files-delete"
          disabled={chosenFiles.length === 0}
          onClick={() => onDelete(chosenFiles, deleteDownloads)}
        >
          {actionLabel()}
        </Button>
      </div>
    </div>
  );
};

/**
 * Asks which of the files the user has of a mod to remove, each with pills saying whether it's
 * installed, its download is missing, or it's only downloaded. Removing uninstalls by default,
 * keeping downloads to reinstall from; "Also delete downloaded files" deletes them too, and is
 * what lets downloads be chosen. One file is just confirmed, by its name and version, with no list,
 * so an optional file doesn't read as the whole mod.
 */
export const DeleteModFilesModal = ({ files, ...props }: IDeleteModFilesModalProps) => {
  const { t } = useTranslation();

  return (
    <Modal isOpen={!!files} title={t("Remove mod files")} onClose={props.onClose}>
      {!!files && <DeleteModFilesBody {...props} files={files} />}
    </Modal>
  );
};
