import { pathToFileURL } from "url";

import { mdiArrowLeft, mdiChevronLeft, mdiChevronRight } from "@mdi/js";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";

import { deleteGameMediaModTag } from "../actions/persistent";
import { BetaBadge } from "../components/BetaBadge";
// import FloatingSearchBar from "../components/FloatingSearchBar";
import MediaViewSingleDetails from "../components/MediaSingleViewDetails";
import MediaVideoSteamFailed from "../components/MediaVideoSteamFailed";
import type { IModOption } from "../components/ModCombobox";
import ModTagIndicator from "../components/ModTagIndicator";
import useGameMediaModTag from "../hooks/GameMediaModTagHook";
import type { GameMediaItem, ResolvedGameMediaSource } from "../util/mediaTypes";
import MediaSingleViewAddModTagModal from "./MediaSingleViewAddModTagModal";
import MediaSingleViewUploadModal from "./MediaSingleViewUploadModal";

interface IMediaSingleViewProps {
  active?: boolean;
  api: IExtensionApi;
  source: ResolvedGameMediaSource;
  entry: GameMediaItem;
  onBack: () => void;
  next: () => void;
  prev: () => void;
}

export default function MediaSingleView({
  api,
  active,
  onBack,
  entry,
  source,
  next,
  prev,
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isAddingTag) return;
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [next, prev, isAddingTag]);

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

  const onSelectTag = (r: IModOption, comment?: string) => {
    setTags([
      ...(tags ?? []),
      {
        id: r.uid,
        name: r.name,
        modId: r.modId,
        fileId: r.fileId,
        domainName: r.gameDomain,
        x: pendingCoords.x,
        y: pendingCoords.y,
        url: `https://nexusmods.com/${r.gameDomain}/mods/${r.modId}`,
        createdAt: new Date().toISOString(),
        thumbnail: r.thumbnail,
        comment: comment?.trim() || undefined,
      },
    ]);
    setIsAddingTag(false);
  };

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

      <div className="mx-auto grid w-full max-w-8xl grow grid-cols-[minmax(0,1fr)_264px] gap-6 p-6">
        <div className="w-full max-w-8xl">
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
                className="aspect-video min-h-130 w-full"
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

            {/* Marker for currently adding tag */}
            {isAddingTag && pendingCoords && (
              <ModTagIndicator
                gameId={gameId}
                mediaId={entry.id}
                x={pendingCoords.x}
                y={pendingCoords.y}
              />
            )}

            {/* Prev/Next buttons */}
            {!isAddingTag && (
              <Button
                appearance="scrim"
                aria-label="Previous"
                brand="neutral"
                className="absolute top-1/2 left-4 z-10 -translate-y-1/2 rounded-full"
                disabled={!prev}
                leftIconPath={mdiChevronLeft}
                role="button"
                title="Previous"
                onClick={() => prev()}
              />
            )}

            {!isAddingTag && (
              <Button
                appearance="scrim"
                aria-label="Next"
                brand="neutral"
                className="absolute top-1/2 right-4 z-10 -translate-y-1/2 rounded-full"
                disabled={!next}
                leftIconPath={mdiChevronRight}
                role="button"
                title="Next"
                onClick={() => next()}
              />
            )}
          </div>
        </div>

        <MediaViewSingleDetails
          entry={entry}
          gameId={gameId}
          isAddingTag={isAddingTag}
          removeTag={removeTag}
          source={source}
          startUpload={() => setUploadModalVisible(true)}
          tags={tags}
          toggleAddingTag={toggleAddingTag}
        />
      </div>

      {/* Add mod tag modal */}
      <MediaSingleViewAddModTagModal
        api={api}
        domainName={domainName}
        imagePath={entry.path}
        isOpen={isAddingTag && !!pendingCoords}
        pendingCoords={pendingCoords}
        onClose={() => {
          setIsAddingTag(false);
          setPendingCoords(null);
        }}
        onSave={onSelectTag}
      />

      {/* Upload to Nexus Mods Modal */}
      <MediaSingleViewUploadModal
        api={api}
        domainName={domainName}
        entry={entry}
        isOpen={uploadModalVisible}
        tags={tags}
        onClose={() => setUploadModalVisible(false)}
      />
    </Page>
  );
}
