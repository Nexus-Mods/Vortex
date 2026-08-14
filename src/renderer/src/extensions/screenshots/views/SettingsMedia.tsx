import { mdiPlus } from "@mdi/js";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import type { IExtensionApi } from "@/types/api";
import { Button } from "@/ui/components/button/Button";
import { Input } from "@/ui/components/form/input/Input";
import { Switch } from "@/ui/components/form/switch/Switch";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";
import { activeGameId } from "@/util/selectors";

import { setGameMediaSourceEnabled } from "../actions/persistent";
import useGameMedia from "../hooks/GameMediaHook";
import type { GameMediaSource } from "../util/mediaTypes";
import type { IStateWithGameMedia } from "../util/types";

interface ISettingsMediaProps {
  api: IExtensionApi;
}

const SettingsMedia: React.FC<React.PropsWithChildren<ISettingsMediaProps>> = ({
  api,
}: ISettingsMediaProps) => {
  const { t } = useTranslation(["media_page"]);
  const [showAddModal, setShowAddModal] = useState(false);

  const [sourceName, setSourceName] = useState("");
  const [sourcePath, setSourcePath] = useState("");

  const dispatch = useDispatch();
  const gameId = useSelector(activeGameId);
  const disabledSources = useSelector(
    (state: IStateWithGameMedia) => state.persistent.game_media.disabledSources[gameId] ?? [],
  );

  const onToggleSource = useCallback(
    (sourceId: string) => {
      dispatch(setGameMediaSourceEnabled(gameId, sourceId, !disabledSources.includes(sourceId)));
    },
    [dispatch, gameId, disabledSources],
  );

  const { defaultSources, customSources } = useGameMedia();

  const toggleItem = ([id, source]: [string, GameMediaSource]) => (
    <div className="flex w-max items-center gap-3" key={id}>
      <Switch checked={!disabledSources.includes(id)} onChange={() => onToggleSource(id)} />

      <div>
        <Typography as="span" typographyType="body-sm">
          {source.name}
        </Typography>

        <Typography appearance="subdued" as="div" typographyType="body-sm">
          {source.description ?? t("Media from {{source}}", { source: source.name })}
        </Typography>
      </div>
    </div>
  );

  const selectDirectory = async () => {
    try {
      const directory = await api.selectDir({});
      setSourcePath(directory);
    } catch (_) {
      //none
    }
  };

  return (
    <form>
      <div className="mb-4 flex flex-col gap-2">
        <Typography appearance="moderate" typographyType="body-lg">
          {t("Default Sources")}
        </Typography>

        {Object.entries(defaultSources).map(toggleItem)}
      </div>

      <div className="mb-2 flex flex-col gap-2">
        <Typography appearance="moderate" typographyType="body-lg">
          {t("Custom Sources")}
        </Typography>

        {!customSources && (
          <Typography appearance="subdued" typographyType="body-sm">
            {t("No custom media sources.")}
          </Typography>
        )}

        {!!customSources && Object.entries(customSources).map(toggleItem)}
      </div>

      <Button
        appearance="moderate"
        brand="neutral"
        className="max-w-48"
        leftIconPath={mdiPlus}
        size="sm"
        onClick={() => setShowAddModal(true)}
      >
        {t("Add custom source")}
      </Button>

      <Modal
        isOpen={showAddModal}
        size="sm"
        title="Add Custom Media Source"
        onClose={() => setShowAddModal(false)}
      >
        <form>
          <Input
            required
            label="Source Name"
            placeholder="e.g. My Screenshots"
            type="text"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
          />

          <Input
            label="Description"
            placeholder="e.g. Images saved to my screenshots folder"
            type="text"
          />

          {sourcePath}

          <Button onClick={() => void selectDirectory()} />
        </form>
      </Modal>
    </form>
  );
};

export default SettingsMedia;
