import { mdiArrowLeft, mdiClose, mdiOpenInNew } from "@mdi/js";
import React, { useRef, useState } from "react";

import type { IExtensionApi } from "@/types/api";
import { Button } from "@/ui/components/button/Button";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";

import FloatingSearchBar from "../components/FloatingSearchBar";
import MediaViewSingleDetails from "../components/MediaSingleViewDetails";
import ModTagIndicator from "../components/ModTagIndicator";
import useGameMediaModTag from "../hooks/GameMediaModTagHook";
import type { GameMediaItem, GameMediaSource } from "../util/mediaTypes";

interface IMediaSingleViewProps {
  active?: boolean;
  api: IExtensionApi;
  source: GameMediaSource;
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
  const t = api.translate;

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
      message: "Click anywhere on the image to tag a mod.",
      displayMS: 5000,
    });
  };

  return (
    <Page active={active} id="media-details-page" scrollable={false}>
      <PageHeader
        pictogramName="camera"
        subtitle={t("Screenshots and videos from your selected game.")}
        title={t("Media")}
      >
        <Button
          appearance="weak"
          brand="neutral"
          leftIconPath={mdiArrowLeft}
          size="sm"
          type="button"
          onClick={onBack}
        >
          {t("Back")}
        </Button>
      </PageHeader>

      <div className="mx-auto grid size-full max-w-8xl grid-cols-[80%_20%] gap-2 space-y-6 p-4 px-2">
        <div>
          <div
            className={`relative w-full ${isAddingTag ? "cursor-crosshair" : ""}`}
            ref={containerRef}
            onClick={onImageClick}
          >
            {entry.type === "image" && <img className="w-full" src={entry.path} />}

            {entry.type === "video" && (
              <video
                controls
                className="min-h-130 w-full"
                ref={playerRef}
                src={entry.path}
                onError={() =>
                  api.sendNotification({
                    message: "Video failed to load",
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
          removeTag={(id: string) => setTags(tags.filter((t) => t.id !== id))}
          source={source}
          startUpload={() => setUploadModalVisible(true)}
          t={t}
          tags={tags}
          toggleAddingTag={toggleAddingTag}
        />
      </div>

      <Modal
        showCloseButton
        isOpen={uploadModalVisible}
        title="Upload to Nexus Mods"
        onClose={() => setUploadModalVisible(false)}
      >
        <Typography appearance="subdued" className="mb-2">
          It is not currently possible to upload to Nexus Mods in one click, however, Vortex can
          open both the folder containing this file and the image upload page.
        </Typography>

        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            appearance="strong"
            brand="primary"
            leftIconPath={mdiOpenInNew}
            onClick={() => {
              setUploadModalVisible(false);
              window.api.shell.showItemInFolder(entry.path);
              window.api.shell.openUrl(`https://www.nexusmods.com/${domainName}/images/add`);
            }}
          >
            Continue
          </Button>

          <Button
            appearance="subdued"
            brand="neutral"
            leftIconPath={mdiClose}
            onClick={() => setUploadModalVisible(false)}
          >
            Cancel
          </Button>
        </div>
      </Modal>
    </Page>
  );
}
