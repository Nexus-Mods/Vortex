import { mdiDelete, mdiPencil, mdiPlus } from "@mdi/js";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import type { IExtensionApi } from "@/types/api";
import { Button } from "@/ui/components/button/Button";
import { Switch } from "@/ui/components/form/switch/Switch";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { Typography } from "@/ui/components/typography/Typography";

import { activeGameId } from "../../../util/selectors";
import { deleteGameMediaSource, setGameMediaSourceEnabled } from "../actions/persistent";
import useGameMedia from "../hooks/GameMediaHook";
import type { GameMediaSource } from "../util/mediaTypes";
import type { IStateWithGameMedia } from "../util/types";
import SettingsMediaAddSourceModal from "./SettingsMediaAddSourceModal";

interface ISettingsMediaProps {
  api: IExtensionApi;
}

const SettingsMedia: React.FC<React.PropsWithChildren<ISettingsMediaProps>> = ({
  api,
}: ISettingsMediaProps) => {
  const { t } = useTranslation(["media_page"]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editSource, setEditSource] = useState<{ id: string; source: GameMediaSource } | null>();

  const dispatch = useDispatch();
  const gameId = useSelector(activeGameId);
  const disabledSources = useSelector(
    (state: IStateWithGameMedia) => state.persistent.game_media.disabledSources[gameId] ?? [],
  );

  const onToggleSource = useCallback(
    (sourceId: string) => {
      dispatch(setGameMediaSourceEnabled(gameId, sourceId, disabledSources.includes(sourceId)));
    },
    [dispatch, gameId, disabledSources],
  );

  const onDeleteSource = useCallback(
    (sourceId: string) => {
      dispatch(deleteGameMediaSource(gameId, sourceId));
    },
    [dispatch, gameId],
  );

  const onEditSource = (id: string, source: GameMediaSource) => {
    setEditSource({ id, source });
    setShowAddModal(true);
  };

  const { defaultSources, customSources } = useGameMedia();

  const toggleItem = ([id, source]: [string, GameMediaSource]) => (
    <div className="flex w-max items-center gap-3" key={id}>
      <Switch
        checked={!disabledSources.includes(id)}
        data-testid={`media-source-toggle-${id}`}
        onChange={() => onToggleSource(id)}
      />

      <div className="min-w-sm grow">
        <Typography as="span" typographyType="body-sm">
          {source.name}
        </Typography>

        <Typography appearance="subdued" as="div" typographyType="body-sm">
          {source.description ?? t("Media from {{source}}", { source: source.name })}
        </Typography>
      </div>

      {source.custom && (
        <ToolbarGroup
          actions={[
            {
              label: "Edit Source",
              iconPath: mdiPencil,
              onClick: () => onEditSource(id, source),
              testId: `source-actions-edit-${id}`,
            },
            {
              label: "Delete Source",
              iconPath: mdiDelete,
              onClick: () => onDeleteSource(id),
              testId: `source-actions-delete-${id}`,
            },
          ]}
        />
      )}
    </div>
  );

  const closeModal = () => {
    setShowAddModal(false);
    setEditSource(null);
  };

  return (
    <form className="flex flex-col gap-4">
      <Typography appearance="moderate" typographyType="body-md">
        {t("Manage the folders scanned when viewing the Media section.")}
      </Typography>

      <div className="flex flex-col gap-2">
        <Typography appearance="moderate" typographyType="body-lg">
          {t("Default Sources")}
        </Typography>

        {Object.entries(defaultSources).map(toggleItem)}
      </div>

      <div className="flex flex-col gap-2">
        <Typography appearance="moderate" typographyType="body-lg">
          {t("Custom Sources")}
        </Typography>

        {!customSources && (
          <Typography appearance="subdued" typographyType="body-sm">
            {t("No custom media sources.")}
          </Typography>
        )}

        {!!customSources &&
          Object.keys(customSources).length > 0 &&
          Object.entries(customSources).map(toggleItem)}
      </div>

      <Button
        appearance="moderate"
        brand="neutral"
        className="max-w-48"
        data-testid={"add-custom-source"}
        leftIconPath={mdiPlus}
        size="sm"
        onClick={() => setShowAddModal(true)}
      >
        {t("Add custom source")}
      </Button>

      <SettingsMediaAddSourceModal
        api={api}
        existingSource={editSource}
        gameId={gameId}
        key={editSource?.id ?? "new"}
        visible={showAddModal}
        onClose={closeModal}
      />
    </form>
  );
};

export default SettingsMedia;
