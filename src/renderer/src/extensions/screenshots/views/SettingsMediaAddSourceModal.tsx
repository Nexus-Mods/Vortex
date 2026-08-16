import { randomUUID } from "crypto";

import { mdiFolderCog } from "@mdi/js";
import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";

import type { IExtensionApi } from "@/types/api";
import { Button } from "@/ui/components/button/Button";
import { Input } from "@/ui/components/form/input/Input";
import { Modal } from "@/ui/components/modal/Modal";

import { addGameMediaSource } from "../actions/persistent";
import type { GameMediaSource } from "../util/mediaTypes";

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
  const t = api.translate;
  const [sourceName, setSourceName] = useState(existingSource?.source?.name ?? "");
  const [sourceDescription, setSourceDescription] = useState(
    existingSource?.source?.description ?? "",
  );
  const [sourcePath, setSourcePath] = useState(existingSource?.source?.path ?? "");
  const dispatch = useDispatch();

  useEffect(() => {
    if (!existingSource) return;
    setSourceName(existingSource?.source?.name);
    setSourceDescription(existingSource?.source?.description);
    setSourcePath(existingSource?.source?.path);
  }, [existingSource]);

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
      description: sourceDescription.length ? sourceDescription : undefined,
      custom: true,
    };

    const newSourceId = existingSource?.id ?? randomUUID();

    dispatch(addGameMediaSource(gameId, newSourceId, newSource));
    onCloseWithReset();
  };

  return (
    <Modal isOpen={visible} size="sm" title="Add Custom Media Source" onClose={onCloseWithReset}>
      <form className="flex flex-col gap-2">
        <Input
          required
          label="Source Name"
          placeholder={t("e.g. My Screenshots")}
          type="text"
          value={sourceName}
          onChange={(e) => setSourceName(e.target.value)}
        />

        <Input
          label={t("Description")}
          placeholder={t("e.g. Images saved to my screenshots folder")}
          type="text"
          value={sourceDescription}
          onChange={(e) => setSourceDescription(e.target.value)}
        />

        <div className="flex items-end">
          <Input
            required
            fieldClassName="grow"
            label={t("Folder Path")}
            type="text"
            value={sourcePath}
            onClick={() => void selectDirectory()}
          />

          <Button
            appearance="subdued"
            brand="neutral"
            className="shrink-0 self-end"
            leftIconPath={mdiFolderCog}
            onClick={() => void selectDirectory()}
          />
        </div>

        <div>
          <Button disabled={!sourceName.length || !sourcePath} onClick={saveMediaSource}>
            {t("Save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
