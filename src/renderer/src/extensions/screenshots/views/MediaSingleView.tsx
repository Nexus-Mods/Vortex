import { pathToFileURL } from "url";

import { mdiArrowLeft, mdiClose, mdiOpenInNew } from "@mdi/js";
import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";

import { deleteGameMediaModTag } from "../actions/persistent";
import { BetaBadge } from "../components/BetaBadge";
import FloatingSearchBar from "../components/FloatingSearchBar";
import MediaViewSingleDetails from "../components/MediaSingleViewDetails";
import MediaVideoSteamFailed from "../components/MediaVideoSteamFailed";
import ModTagIndicator from "../components/ModTagIndicator";
import useGameMediaModTag from "../hooks/GameMediaModTagHook";
import type { GameMediaItem, ResolvedGameMediaSource } from "../util/mediaTypes";

interface IMediaSingleViewProps {
  active?: boolean;
  api: IExtensionApi;
  source: ResolvedGameMediaSource;
  entry: GameMediaItem;
  onBack: () => void;
}

export default function MediaSingleView({
  api,
  active,
  onBack,
  entry,
  source,
}: IMediaSingleViewProps) {
  const { t } = useTranslation("media_page");
  const dispatch = useDispatch();

  const {
    containerRef,
    isAddingTag,
    setIsAddingTag,
    tags,
    setTags,
    pendingCoords,
    setPendingCoords,
    onImageClick,
    domainName,
    gameId,
  } = useGameMediaModTag(entry.id);

  const playerRef = useRef<HTMLVideoElement | null>(null);

  const [uploadModalVisible, setUploadModalVisible] = useState(false);

  // This would be a potential solution to being unable to play videos from Steam.
  // Steam videos are broken into m4s files with a mpd manifest. A library player is needed to stream videos this way.
  // useEffect(() => {
  //   if (playerRef.current && entry.path.endsWith(".mpd")) {
  //     const createDashPlayer = async () => {
  //       const dashjs = await import("dashjs");
  //       const player = dashjs.MediaPlayer().create();
  //       player.initialize(playerRef.current, entry.path, true);
  //     };
  //     void createDashPlayer();
  //   }
  // }, [entry.path]);

  const toggleAddingTag = () => {
    if (isAddingTag) return setIsAddingTag(false);
    setPendingCoords(null);
    setIsAddingTag(true);
    api.sendNotification({
      type: "info",
      message: t("single::start_tagging"),
      displayMS: 5000,
    });
  };

  const removeTag = (modId: string) => {
    if (!entry) return;
    dispatch(deleteGameMediaModTag(gameId, entry.id, modId));
  };

  const mediaSrc = useMemo(() => pathToFileURL(entry.path).toString(), [entry.path]);

  return (
    <Page active={active} id="media-details-page" scrollable={false}>
      <PageHeader
        // title={t("shared::title")}
        customTitle={(compact) => (
          <div className="flex items-center gap-x-1.5">
            <Typography
              appearance={compact ? "subdued" : "moderate"}
              as="h2"
              className="transition-colors"
              typographyType="heading-xs"
            >
              {t("shared::title")}
            </Typography>

            <BetaBadge isSubdued={compact} />
          </div>
        )}
        pictogramName="camera"
        subtitle={t("shared::subtitle")}
      >
        <Button
          appearance="weak"
          brand="neutral"
          leftIconPath={mdiArrowLeft}
          size="sm"
          type="button"
          onClick={onBack}
        >
          {t("common:::back")}
        </Button>
      </PageHeader>

      <div className="mx-auto grid size-full max-w-8xl grid-cols-[80%_20%] gap-2 space-y-6 p-4 px-2">
        <div>
          <div
            className={`relative w-full ${isAddingTag ? "cursor-crosshair" : ""}`}
            ref={containerRef}
            onClick={onImageClick}
          >
            {entry.type === "image" && <img alt={entry.name} className="w-full" src={mediaSrc} />}

            {entry.type === "video" && entry.path.endsWith(".mpd") && <MediaVideoSteamFailed />}

            {entry.type === "video" && !entry.path.endsWith(".mpd") && (
              <video
                controls
                className="min-h-130 w-full"
                ref={playerRef}
                src={mediaSrc}
                onError={() =>
                  api.sendNotification({
                    message: t("single::video_failed"),
                    displayMS: 5000,
                    type: "error",
                  })
                }
              />
            )}

            {/* Persistent markers */}
            {tags?.map((tag) => (
              <ModTagIndicator
                gameId={gameId}
                key={tag.id}
                mediaId={entry.id}
                mod={tag}
                x={tag.x}
                y={tag.y}
              />
            ))}

            {/* Floating search at cursor when a pending coord is set */}
            {isAddingTag && pendingCoords && (
              <FloatingSearchBar
                visible
                api={api}
                containerRef={containerRef}
                leftPct={pendingCoords.x}
                topPct={pendingCoords.y}
                onClose={() => {
                  setIsAddingTag(false);
                  setPendingCoords(null);
                }}
                onSelect={(r, comment) => {
                  setTags([
                    ...(tags ?? []),
                    {
                      id: r.uid,
                      name: r.name,
                      x: pendingCoords.x,
                      y: pendingCoords.y,
                      url: `https://nexusmods.com/${domainName}/mods/${r.modId}`,
                      createdAt: new Date().toISOString(),
                      thumbnail: r.adult ? r.thumbnailBlurredUrl : r.thumbnailUrl,
                      comment: comment?.trim() || undefined,
                    },
                  ]);
                  setIsAddingTag(false);
                }}
              />
            )}

            {isAddingTag && pendingCoords && (
              <ModTagIndicator
                gameId={gameId}
                mediaId={entry.id}
                x={pendingCoords.x}
                y={pendingCoords.y}
              />
            )}
          </div>
        </div>

        <MediaViewSingleDetails
          entry={entry}
          isAddingTag={isAddingTag}
          removeTag={removeTag}
          source={source}
          startUpload={() => setUploadModalVisible(true)}
          tags={tags}
          toggleAddingTag={toggleAddingTag}
        />
      </div>

      <Modal
        showCloseButton
        isOpen={uploadModalVisible}
        title={t("single::upload::title")}
        onClose={() => setUploadModalVisible(false)}
      >
        <Typography appearance="subdued" className="mb-2">
          {t("single::upload::body")}
        </Typography>

        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            appearance="strong"
            brand="primary"
            leftIconPath={mdiOpenInNew}
            onClick={() => {
              const uploadPath = entry.type === "image" ? "images" : "videos";
              setUploadModalVisible(false);
              window.api.shell.showItemInFolder(entry.path);
              window.api.shell.openUrl(`https://www.nexusmods.com/${domainName}/${uploadPath}/add`);
            }}
          >
            {t("single::actions::continue")}
          </Button>

          <Button
            appearance="subdued"
            brand="neutral"
            leftIconPath={mdiClose}
            onClick={() => setUploadModalVisible(false)}
          >
            {t("single::actions::cancel")}
          </Button>
        </div>
      </Modal>
    </Page>
  );
}
