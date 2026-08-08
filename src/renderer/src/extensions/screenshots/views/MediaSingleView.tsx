import { mdiArrowLeft, mdiCloudUpload, mdiOpenInNew, mdiPlus } from "@mdi/js";
import React from "react";

import type { IExtensionApi } from "@/types/api";
import { Button } from "@/ui/components/button/Button";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { Typography } from "@/ui/components/typography/Typography";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";

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
          {entry.type === "image" && <img className="w-full" src={entry.path} />}

          {entry.type === "video" && <video />}
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
              <i>None</i>

              <Button appearance="subdued" brand="neutral" leftIconPath={mdiPlus} size="xs">
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
