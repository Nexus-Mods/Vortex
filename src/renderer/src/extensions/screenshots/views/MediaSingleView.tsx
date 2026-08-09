import { mdiArrowLeft, mdiCancel, mdiCloudUpload, mdiDelete, mdiOpenInNew, mdiPlus } from "@mdi/js";
import React from "react";

import type { IExtensionApi } from "@/types/api";
import { Alert } from "@/ui/components/alert/Alert";
import { Button } from "@/ui/components/button/Button";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { Typography } from "@/ui/components/typography/Typography";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";

import FloatingSearchBar from "../components/FloatingSearchBar";
import ModTagIndicator from "../components/ModTagIndicator";
import useGameMediaModTag from "../hooks/GameMediaModTagHook";
import type { MediaItem, MediaSource } from "../util/mediaTypes";

interface IMediaSingleViewProps {
  active?: boolean;
  api: IExtensionApi;
  source: MediaSource;
  entry: MediaItem;
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

  const toolbarActions: IToolbarAction[] = [
    {
      label: "Upload",
      iconPath: mdiCloudUpload,
      showLabel: true,
      disabled: false,
      brand: "primary",
    },
    {
      label: "Open Folder",
      iconPath: mdiOpenInNew,
      onClick: () => window.api.shell.openFile(entry.path),
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
          {isAddingTag && (
            <div>
              <Alert
                action={
                  <Button
                    appearance="subdued"
                    brand="neutral"
                    leftIconPath={mdiCancel}
                    size="xs"
                    onClick={() => setIsAddingTag(false)}
                  >
                    Cancel
                  </Button>
                }
                severity="info"
              >
                <Typography brand="info" typographyType="body-sm">
                  {t("Click anywhere on the image to tag a mod.")}
                </Typography>
              </Alert>
            </div>
          )}

          <div
            className={`relative w-full ${isAddingTag ? "cursor-pointer" : ""}`}
            ref={containerRef}
            onClick={onImageClick}
          >
            {entry.type === "image" && <img className="w-full" src={entry.path} />}

            {entry.type === "video" && <video />}

            {/* Persistent markers */}
            {!isAddingTag &&
              tags?.map((tag) => <ModTagIndicator key={tag.id} mod={tag} x={tag.x} y={tag.y} />)}

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

              <ul className="ml-2 list-disc">
                {tags?.map((t) => (
                  <li className="flex justify-between gap-2" key={t.id}>
                    <a href={t.url} title={t.id}>
                      {t.name}
                    </a>

                    <Button
                      appearance="subdued"
                      brand="primary"
                      leftIconPath={mdiDelete}
                      size="xs"
                      onClick={() => setTags(tags.filter((at) => at.id !== t.id))}
                    />
                  </li>
                ))}
              </ul>

              <Button
                appearance="subdued"
                brand="neutral"
                disabled={isAddingTag}
                leftIconPath={mdiPlus}
                size="xs"
                onClick={() => {
                  setPendingCoords(null);
                  setIsAddingTag(true);
                }}
              >
                Add mod
              </Button>
            </Typography>
          </div>

          <Toolbar>
            <ToolbarGroup actions={toolbarActions} />
          </Toolbar>
        </div>
      </div>
    </Page>
  );
}
