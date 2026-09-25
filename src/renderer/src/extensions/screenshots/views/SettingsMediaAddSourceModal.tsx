import { mdiFolderCog } from "@mdi/js";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import type { IExtensionApi } from "@/types/api";
import { Button } from "@/ui/components/button/Button";
import { Input } from "@/ui/components/form/input/Input";
import { Modal } from "@/ui/components/modal/Modal";

import { addGameMediaSource } from "../actions/persistent";
import type { GameMediaSource } from "../util/mediaTypes";
import { resolveTString } from "../util/resolveTString";

interface ISettingsMediaAddSourceModalProps {
  gameId: string;
  visible: boolean;
  onClose: () => void;
  api: IExtensionApi;
  existingSource?: { id: string; source: GameMediaSource };
}

export default function SettingsMediaAddSourceModal({
  gameId,
  visible,
  onClose,
  api,
  existingSource,
}: ISettingsMediaAddSourceModalProps) {
  const { t } = useTranslation(["media_page"]);
  const [sourceName, setSourceName] = useState(() => existingSource?.source?.name ?? "");
  const [sourcePath, setSourcePath] = useState(() => existingSource?.source?.path ?? "");
  const [sourceDescription, setSourceDescription] = useState(
    () => existingSource?.source?.description ?? "",
  );
  const dispatch = useDispatch();

  const selectDirectory = async () => {
    try {
      const directory = await api.selectDir({});
      setSourcePath(directory);
    } catch {
      window.api.log("warn", "Selection of directory failed");
    }
  };

  const onCloseWithReset = () => {
    onClose();
    setSourceName("");
    setSourceDescription("");
    setSourcePath("");
  };

  const saveMediaSource = () => {
    const newSource: GameMediaSource = {
      name: sourceName,
      path: sourcePath,
      description: sourceDescription.toString().length ? sourceDescription : undefined,
      custom: true,
    };

    const newSourceId = existingSource?.id ?? crypto.randomUUID();

    dispatch(addGameMediaSource(gameId, newSourceId, newSource));
    onCloseWithReset();
  };

  return (
    <Modal
      isOpen={visible}
      size="sm"
      title={
        existingSource
          ? t("settings::add_modal::header_edit")
          : t("settings::add_modal::header_add")
      }
      onClose={onCloseWithReset}
    >
      <form className="flex flex-col gap-2">
        <Input
          required
          id="media-source-name"
          label={t("settings::add_modal::source_name")}
          placeholder={t("settings::add_modal::source_name_placeholder")}
          type="text"
          value={resolveTString(t, sourceName)}
          onChange={(e) => setSourceName(e.target.value)}
        />

        <Input
          id="media-source-description"
          label={t("settings::add_modal::source_desc")}
          placeholder={t("settings::add_modal::source_desc_placeholder")}
          type="text"
          value={resolveTString(t, sourceDescription)}
          onChange={(e) => setSourceDescription(e.target.value)}
        />

        <div className="flex items-end">
          <Input
            readOnly
            required
            fieldClassName="grow"
            id="media-source-path"
            label={t("settings::add_modal::source_path")}
            type="text"
            value={sourcePath}
            onClick={() => void selectDirectory()}
          />

          <Button
            appearance="subdued"
            brand="neutral"
            className="shrink-0 self-end"
            leftIconPath={mdiFolderCog}
            title={t("settings::add_modal::source_path_select")}
            onClick={() => void selectDirectory()}
          />
        </div>

        <div>
          <Button
            disabled={!resolveTString(t, sourceName).length || !sourcePath}
            onClick={saveMediaSource}
          >
            {t("shared::save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
