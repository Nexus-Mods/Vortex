import { mdiClipboardOutline, mdiClose, mdiOpenInNew } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";

import type { GameMediaItem, GameMediaModTag } from "../util/mediaTypes";

interface IMediaSingleViewUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: GameMediaItem;
  domainName: string;
  tags: readonly GameMediaModTag[];
  api: IExtensionApi;
}

export default function MediaSingleViewUploadModal({
  isOpen,
  onClose,
  domainName,
  entry,
  tags,
  api,
}: IMediaSingleViewUploadModalProps) {
  const { t } = useTranslation("media_page");

  const openFileAndUploadPage = () => {
    const uploadPath = entry.type === "image" ? "images" : "videos";
    onClose();
    window.api.shell.showItemInFolder(entry.path);
    window.api.shell.openUrl(`https://www.nexusmods.com/${domainName}/${uploadPath}/add`);
  };

  const copyBBCodeToClipboard = async () => {
    try {
      await window.api.clipboard.writeText(gameMediaTagsToBBCode(tags));
      api.sendNotification({
        type: "info",
        message: t("single::upload::copy_success"),
        displayMS: 5000,
      });
    } catch {
      api.sendNotification({
        type: "error",
        message: t("single::upload::copy_failed"),
        displayMS: 5000,
      });
    }
  };

  return (
    <Modal showCloseButton isOpen={isOpen} title={t("single::upload::title")} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Typography appearance="subdued" className="mb-2">
          {t("single::upload::body")}
        </Typography>

        {tags?.length > 0 && (
          <div className="flex items-center justify-between gap-4">
            <Typography brand="info" typographyType="body-sm">
              {t("single::upload::tag_count", { count: tags.length })}
            </Typography>

            <Button
              appearance="subdued"
              brand="info"
              leftIconPath={mdiClipboardOutline}
              size="sm"
              onClick={() => void copyBBCodeToClipboard()}
            >
              {t("single::actions::copy_bbcode")}
            </Button>
          </div>
        )}

        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            appearance="strong"
            brand="primary"
            leftIconPath={mdiOpenInNew}
            onClick={openFileAndUploadPage}
          >
            {t("single::actions::continue")}
          </Button>

          <Button appearance="subdued" brand="neutral" leftIconPath={mdiClose} onClick={onClose}>
            {t("single::actions::cancel")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function gameMediaTagsToBBCode(tags: readonly GameMediaModTag[]): string | undefined {
  if (!tags || !tags.length) return undefined;
  const tagList = tags
    .map(
      (t) =>
        `[*][url=https://www.nexusmods.com/${t.domainName}/mods/${t.modId}/tab?=files&file_id=${t.fileId}&nmm=1]${t.name}[/url]`,
    )
    .join("\n");

  return `[size=4][b]Mods in this image[/b][/size]\n\n[list]\n${tagList}\n[/list]\n[line]`;
}
