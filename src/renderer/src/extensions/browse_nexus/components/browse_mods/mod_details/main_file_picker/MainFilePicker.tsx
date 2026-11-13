import type { IFileInfo } from "@nexusmods/nexus-api";
import React from "react";
import { useTranslation } from "react-i18next";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";

import { MainFileCard } from "./main_file_card/MainFileCard";

interface IMainFilePickerProps {
  api: IExtensionApi;
  /** The mod to choose a file of. */
  mod: ModSummary;
  /** Its Main files, in the order to list them. */
  files: IFileInfo[];
  /** Whether the dialog is showing. */
  isOpen: boolean;
  /** Called when the user closes it; a card's action doesn't. */
  onClose: () => void;
}

/** A dialog listing a mod's Main files as cards, each with its own install, to choose from. */
export const MainFilePicker = ({ api, mod, files, isOpen, onClose }: IMainFilePickerProps) => {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} size="lg" title={t("Choose a file to install")} onClose={onClose}>
      <div className="space-y-4">
        <Typography
          appearance="subdued"
          data-testid="main-file-picker-summary"
          typographyType="body-sm"
        >
          {files.length === 1
            ? t("{{mod}} has 1 main file. Choose which you'd like to install.", { mod: mod.name })
            : t("{{mod}} has {{count}} main files. Choose which you'd like to install.", {
                mod: mod.name,
                count: files.length,
              })}
        </Typography>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          {files.map((file) => (
            <MainFileCard key={file.file_id} api={api} file={file} mod={mod} onLeave={onClose} />
          ))}
        </div>

        <div className="flex justify-end">
          <Button
            appearance="moderate"
            brand="neutral"
            data-testid="main-file-picker-close"
            onClick={onClose}
          >
            {t("Close")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
