import {
  mdiArrowLeft,
  mdiCancel,
  mdiClose,
  mdiCloudUpload,
  mdiOpenInNew,
  mdiTagPlus,
  mdiTagRemove,
} from "@mdi/js";
import React, { useState } from "react";

import type { IExtensionApi } from "@/types/api";
import { Button } from "@/ui/components/button/Button";
import { Modal } from "@/ui/components/modal/Modal";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { Typography } from "@/ui/components/typography/Typography";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";

import FloatingSearchBar from "../components/FloatingSearchBar";
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
  } = useGameMediaModTag(entry.id);

  const [uploadModalVisible, setUploadModalVisible] = useState(false);

  const toolbarActions: IToolbarAction[] = [
    {
      label: "Upload",
      iconPath: mdiCloudUpload,
      showLabel: true,
      disabled: false,
      brand: "primary",
      onClick: () => setUploadModalVisible(true),
    },
    {
      label: "Open File",
      iconPath: mdiOpenInNew,
      onClick: () => window.api.shell.showItemInFolder(entry.path),
    },
  ];

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

      <div className="my-4 grid h-full grid-cols-[80%_20%] gap-2 px-2">
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
              <ModTagIndicator key={tag.id} mod={tag} x={tag.x} y={tag.y} />
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
              <ModTagIndicator x={pendingCoords.x} y={pendingCoords.y} />
            )}
          </div>
        </div>

        <div className="mx-1 flex flex-col rounded-sm bg-surface-mid p-2 select-text">
          <Typography
            as="h6"
            className="mb-2 border-b border-translucent-subdued"
            typographyType="heading-xs"
          >
            Details
          </Typography>

          <div className="grid grid-cols-[20%_80%] gap-2">
            <Typography appearance="strong" typographyType="body-sm">
              Name:
            </Typography>

            <Typography appearance="subdued" brand="neutral" typographyType="body-sm">
              {entry.name}
            </Typography>

            <Typography appearance="strong" typographyType="body-sm">
              Type:
            </Typography>

            <Typography appearance="subdued" brand="neutral" typographyType="body-sm">
              {entry.type}
            </Typography>

            <Typography appearance="strong" typographyType="body-sm">
              Source:
            </Typography>

            <Typography appearance="subdued" brand="neutral" typographyType="body-sm">
              {source?.name ?? entry.sourceId}
            </Typography>

            {!!entry.size && (
              <>
                <Typography appearance="strong" typographyType="body-sm">
                  Size:
                </Typography>

                <Typography appearance="subdued" brand="neutral" typographyType="body-sm">
                  {entry.size}
                </Typography>
              </>
            )}

            <Typography appearance="strong" typographyType="body-sm">
              Path:
            </Typography>

            <Typography
              appearance="subdued"
              brand="neutral"
              className="wrap-break-word select-text"
              typographyType="body-sm"
            >
              {entry.path}
            </Typography>
          </div>

          <div className="grow overflow-auto">
            <Typography
              as="h6"
              className="my-2 border-b border-translucent-subdued"
              typographyType="heading-xs"
            >
              Featured Mods
            </Typography>

            <Typography className="max-h-48 overflow-auto" typographyType="body-sm">
              {(!tags || tags?.length === 0) && <i>None</i>}

              <ul className="mb-2 list-inside list-disc">
                {tags?.map((t) => (
                  <li className="ml-2 flex items-center justify-between gap-2" key={t.id}>
                    <a className="line-clamp-2" href={t.url} title={t.name}>
                      {t.name}
                    </a>

                    <Button
                      appearance="subdued"
                      brand="neutral"
                      leftIconPath={mdiTagRemove}
                      size="sm"
                      title="Remove"
                      onClick={() => setTags(tags.filter((at) => at.id !== t.id))}
                    />
                  </li>
                ))}
              </ul>

              <Button
                appearance="subdued"
                brand="neutral"
                leftIconPath={isAddingTag ? mdiCancel : mdiTagPlus}
                size="sm"
                onClick={() => {
                  if (isAddingTag) return setIsAddingTag(false);
                  setPendingCoords(null);
                  setIsAddingTag(true);
                  api.sendNotification({
                    type: "info",
                    message: "Click anywhere on the image to tag a mod.",
                    displayMS: 5000,
                  });
                }}
              >
                {isAddingTag ? "Cancel adding" : "Add mod"}
              </Button>
            </Typography>
          </div>

          <Toolbar>
            <ToolbarGroup actions={toolbarActions} />
          </Toolbar>
        </div>
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
