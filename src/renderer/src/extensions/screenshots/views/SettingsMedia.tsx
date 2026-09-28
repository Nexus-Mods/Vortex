import { mdiAlertOutline, mdiDelete, mdiPencil, mdiPlus } from "@mdi/js";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { shallowEqual, useDispatch, useSelector } from "react-redux";

import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { Switch } from "@/ui/components/form/switch/Switch";
import { Icon } from "@/ui/components/icon/Icon";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { Typography } from "@/ui/components/typography/Typography";
import { activeGameId } from "@/util/selectors";

import {
  clearGameMediaModTags,
  deleteGameMediaSource,
  setGameMediaSourceEnabled,
  setGameMetaFlag,
} from "../actions/persistent";
import useGameMediaSources from "../hooks/GameMediaSourcesHook";
import * as selectors from "../selectors";
import type { ResolvedGameMediaSource } from "../util/mediaTypes";
import { resolveTString } from "../util/resolveTString";
import SettingsMediaAddSourceModal from "./SettingsMediaAddSourceModal";

interface ISettingsMediaProps {
  api: IExtensionApi;
}

const SettingsMedia: React.FC<React.PropsWithChildren<ISettingsMediaProps>> = ({
  api,
}: ISettingsMediaProps) => {
  const { t } = useTranslation(["media_page"]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editSource, setEditSource] = useState<{
    id: string;
    source: ResolvedGameMediaSource;
  } | null>();

  const dispatch = useDispatch();
  const gameId = useSelector(activeGameId);
  const disabledSources = useSelector((state: IState) => selectors.disabledSources(state, gameId));
  const items = useSelector(selectors.sessionItems);
  const orphans = useSelector(
    (state: IState) => selectors.orphanedTagIds(state, gameId, items),
    shallowEqual,
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

  const onEditSource = (id: string, source: ResolvedGameMediaSource) => {
    setEditSource({ id, source });
    setShowAddModal(true);
  };

  const onChangeFlag = useCallback(
    (name: string, value: boolean) => {
      dispatch(setGameMetaFlag(name, value));
    },
    [dispatch],
  );

  const { defaultSources, customSources, flags } = useGameMediaSources();

  const toggleItem = ([id, source]: [string, ResolvedGameMediaSource]) => (
    <div className="flex w-max items-center gap-3" key={id}>
      <Switch
        checked={!disabledSources.includes(id)}
        data-testid={`media-source-toggle-${id}`}
        onChange={() => onToggleSource(id)}
      />

      <div className="min-w-sm grow">
        <Typography as="span" typographyType="body-sm">
          {resolveTString(t, source.name)}
        </Typography>

        <Typography appearance="subdued" as="div" typographyType="body-sm">
          {resolveTString(t, source.description) ??
            t("shared::media_from", { source: resolveTString(t, source.name) })}
        </Typography>
      </div>

      {source.custom && (
        <ToolbarGroup
          actions={[
            {
              label: t("settings::edit_source"),
              iconPath: mdiPencil,
              onClick: () => onEditSource(id, source),
              testId: `source-actions-edit-${id}`,
            },
            {
              label: t("settings::delete_source"),
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
        {t("settings::description")}
      </Typography>

      <div className="flex flex-col gap-2">
        <Typography appearance="moderate" typographyType="body-lg">
          {t("settings::header_default")}
        </Typography>

        {Object.entries(defaultSources)?.map(toggleItem)}
      </div>

      <div className="flex flex-col gap-2">
        <Typography appearance="moderate" typographyType="body-lg">
          {t("settings::header_custom")}
        </Typography>

        {(!customSources || Object.keys(customSources).length === 0) && (
          <Typography appearance="subdued" typographyType="body-sm">
            {t("settings::no_custom")}
          </Typography>
        )}

        {!!customSources &&
          Object.keys(customSources).length > 0 &&
          Object.entries(customSources)?.map(toggleItem)}
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
        {t("settings::add_custom")}
      </Button>

      {!!items?.length && disabledSources.length === 0 && orphans.length > 0 && (
        <div className="flex items-center gap-3">
          <Typography appearance="subdued" typographyType="body-sm">
            {t("settings::orphaned_tags", {
              count: orphans.length,
            })}
          </Typography>

          <Button
            appearance="subdued"
            brand="neutral"
            size="sm"
            onClick={() => dispatch(clearGameMediaModTags(gameId, orphans))}
          >
            {t("shared::remove")}
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Typography appearance="moderate" typographyType="body-lg">
          {t("settings::header_exp")}
        </Typography>

        <div className="flex w-max items-center gap-3">
          <Switch
            checked={flags.showVideos}
            data-testid={`media-source-toggle-vidoes`}
            onChange={() => onChangeFlag("showVideos", flags.showVideos ? false : true)}
          />

          <div className="min-w-sm grow">
            <Typography as="span" typographyType="body-sm">
              {t("settings::exp::video_support")}
            </Typography>

            <Typography appearance="subdued" as="div" typographyType="body-sm">
              {t("settings::exp::video_support_desc")}
            </Typography>

            <Typography
              appearance="subdued"
              className="nxm-alert-warning flex items-start gap-2"
              typographyType="body-sm"
            >
              <Icon className="nxm-alert-icon inline" path={mdiAlertOutline} size="sm" />

              {t("settings::exp::video_support_warn")}

              <a href="https://ffmpeg.org/">{t("settings::exp::get_ffmpeg")}</a>
            </Typography>
          </div>
        </div>
      </div>

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
