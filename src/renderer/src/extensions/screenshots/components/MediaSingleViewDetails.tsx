import { mdiCancel, mdiCloudUpload, mdiOpenInNew, mdiTagPlus, mdiTagRemove } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { Typography } from "@/ui/components/typography/Typography";
import relativeTime from "@/util/relativeTime";
import { bytesToString } from "@/util/util";

import type { GameMediaItem, GameMediaModTag, GameMediaSource } from "../util/mediaTypes";
import { resolveTString } from "../util/resolveTString";

interface IMediaViewSingleDetailsProps {
  entry: GameMediaItem;
  source: GameMediaSource;
  tags: readonly GameMediaModTag[];
  isAddingTag: boolean;
  removeTag: (id: string) => void;
  startUpload: () => void;
  toggleAddingTag: () => void;
}

export default function MediaViewSingleDetails({
  entry,
  source,
  tags,
  isAddingTag,
  startUpload,
  toggleAddingTag,
  removeTag,
}: IMediaViewSingleDetailsProps) {
  const { t } = useTranslation("media_page");

  const toolbarActions: IToolbarAction[] = [
    {
      label: t("single::actions::upload"),
      iconPath: mdiCloudUpload,
      showLabel: true,
      disabled: false,
      brand: "info",
      onClick: startUpload,
    },
    {
      label: t("single::actions::open"),
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
        {t("single::details")}
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
          {resolveTString(t, source?.name) ?? entry.sourceId}
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
          {t("single::featured_mods")}
        </Typography>

        <Typography className="max-h-48 overflow-auto" typographyType="body-sm">
          {(!tags || tags?.length === 0) && <i>{t("single::no_tags")}</i>}

          <ul className="mb-2 list-inside list-disc">
            {tags?.map((tag) => (
              <li className="ml-2 flex items-center justify-between gap-2" key={tag.id}>
                <a className="line-clamp-2" href={tag.url} title={tag.name}>
                  {tag.name}
                </a>

                <Button
                  appearance="subdued"
                  brand="neutral"
                  leftIconPath={mdiTagRemove}
                  size="sm"
                  title={t("common:::remove")}
                  onClick={() => removeTag(tag.id)}
                />
              </li>
            ))}
          </ul>

          <Button
            appearance="subdued"
            brand="neutral"
            disabled={entry.type === "video"}
            leftIconPath={isAddingTag ? mdiCancel : mdiTagPlus}
            size="sm"
            title={
              entry.type === "video"
                ? t("single::video_tag_disabled")
                : t("single::actions::add_mod")
            }
            onClick={toggleAddingTag}
          >
            {isAddingTag ? t("single::actions::cancel") : t("single::actions::add_mod")}
          </Button>
        </Typography>
      </div>

      <Toolbar>
        <ToolbarGroup actions={toolbarActions} />
      </Toolbar>
    </div>
  );
}
