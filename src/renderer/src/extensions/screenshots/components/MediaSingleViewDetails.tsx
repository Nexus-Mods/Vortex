import { mdiCancel, mdiCloudUpload, mdiOpenInNew, mdiTagPlus, mdiTagRemove } from "@mdi/js";
import type { TFunction } from "i18next";
import React from "react";

import { Button } from "@/ui/components/button/Button";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { Typography } from "@/ui/components/typography/Typography";
import relativeTime from "@/util/relativeTime";
import { bytesToString } from "@/util/util";

import type { GameMediaItem, GameMediaModTag, GameMediaSource } from "../util/mediaTypes";

interface IMediaViewSingleDetailsProps {
  t: TFunction;
  entry: GameMediaItem;
  source: GameMediaSource;
  tags: GameMediaModTag[];
  isAddingTag: boolean;
  removeTag: (id: string) => void;
  startUpload: () => void;
  toggleAddingTag: () => void;
}

export default function MediaViewSingleDetails({
  t,
  entry,
  source,
  tags,
  isAddingTag,
  startUpload,
  toggleAddingTag,
  removeTag,
}: IMediaViewSingleDetailsProps) {
  const toolbarActions: IToolbarAction[] = [
    {
      label: "Upload",
      iconPath: mdiCloudUpload,
      showLabel: true,
      disabled: false,
      brand: "info",
      onClick: startUpload,
    },
    {
      label: "Open File",
      iconPath: mdiOpenInNew,
      showLabel: true,
      onClick: () => window.api.shell.showItemInFolder(entry.path),
    },
  ];

  return (
    <div className="mx-1 flex flex-col select-text">
      <Typography
        as="h6"
        className="mb-2 border-b border-translucent-subdued"
        typographyType="heading-xs"
      >
        Details
      </Typography>

      <div className="grid grid-cols-[20%_80%] gap-4">
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
              {bytesToString(entry.size)}
            </Typography>
          </>
        )}

        {!!entry.createdAt && (
          <>
            <Typography appearance="strong" typographyType="body-sm">
              Created:
            </Typography>

            <Typography
              appearance="subdued"
              brand="neutral"
              title={entry.createdAt.toString()}
              typographyType="body-sm"
            >
              {relativeTime(entry.createdAt, t)}
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
                  onClick={() => removeTag(t.id)}
                />
              </li>
            ))}
          </ul>

          <Button
            appearance="subdued"
            brand="neutral"
            leftIconPath={isAddingTag ? mdiCancel : mdiTagPlus}
            size="sm"
            onClick={toggleAddingTag}
          >
            {isAddingTag ? t("Cancel adding") : t("Add mod")}
          </Button>
        </Typography>
      </div>

      <Toolbar>
        <ToolbarGroup actions={toolbarActions} />
      </Toolbar>
    </div>
  );
}
