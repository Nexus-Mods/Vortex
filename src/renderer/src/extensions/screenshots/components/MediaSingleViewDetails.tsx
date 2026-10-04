import {
  mdiCancel,
  mdiClose,
  mdiFolderOpenOutline,
  mdiImageOutline,
  mdiTag,
  mdiTagOutline,
  mdiTagPlus,
  mdiUpload,
} from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Typography } from "@/ui/components/typography/Typography";
import relativeTime from "@/util/relativeTime";
import { bytesToString } from "@/util/util";

import type { GameMediaItem, GameMediaModTag, ResolvedGameMediaSource } from "../util/mediaTypes";
import { resolveTString } from "../util/resolveTString";
import GameMediaModTagPill from "./GameMediaModTagPill";

interface IMediaViewSingleDetailsProps {
  entry: GameMediaItem;
  source: ResolvedGameMediaSource;
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

  const details = [
    { label: t("single::detail::name"), value: entry.name },
    {
      label: t("single::detail::captured"),
      value: entry.createdAt ? relativeTime(entry.createdAt, t) : "N/A",
      title: entry.createdAt?.toLocaleString(),
    },
    { label: t("single::detail::size"), value: entry.size ? bytesToString(entry.size) : "N/A" },
    {
      label: t("single::detail::source"),
      value: resolveTString(t, source?.name) ?? entry.sourceId,
    },
  ];

  return (
    <div className="flex min-w-66 flex-col gap-5 select-text">
      {/* Tagged Mods Section */}
      <section className="flex flex-col gap-5">
        <div className="flex flex-col">
          <Typography as="h3" className="flex items-center gap-1.5" typographyType="body-md">
            <Icon path={mdiTagOutline} size="sm" />

            {t("single::mods_used")}
          </Typography>

          <Typography appearance="subdued" className="italic" typographyType="body-sm">
            {t("single::mods_used_desc")}
          </Typography>
        </div>

        <Button
          appearance="moderate"
          brand="neutral"
          disabled={entry.type === "video"}
          leftIconPath={isAddingTag ? mdiCancel : mdiTagPlus}
          title={
            entry.type === "video" ? t("single::video_tag_disabled") : t("single::actions::add_mod")
          }
          onClick={toggleAddingTag}
        >
          {isAddingTag ? t("single::actions::cancel") : t("single::actions::add_mod")}
        </Button>

        <Button
          appearance="moderate"
          brand="neutral"
          leftIconPath={isAddingTag ? mdiCancel : mdiTagPlus}
          title={
            entry.type === "video" ? t("single::video_tag_disabled") : t("single::actions::add_mod")
          }
          onClick={toggleAddingTag}
        >
          {(isAddingTag ? t("single::actions::cancel") : t("single::actions::add_mod")) + " modal"}
        </Button>

        <div>
          {tags?.length ? (
            tags.map((tag) => (
              <GameMediaModTagPill
                iconPath={mdiClose}
                key={tag.id}
                tag={tag}
                onRemove={() => removeTag(tag.id)}
              />
            ))
          ) : (
            <Typography
              appearance="subdued"
              className="flex items-center gap-1.5 italic"
              typographyType="body-sm"
            >
              <Icon path={mdiTag} size="sm" />

              {t("single::no_tags")}
            </Typography>
          )}
        </div>
      </section>

      <div className="border-b border-b-stroke-subdued/70" />

      {/* Detials Section */}
      <section>
        <dl className="flex flex-col gap-2">
          {details.map(({ label, value, title }) => (
            <div className="flex justify-between gap-2" key={label}>
              <dt>
                <Typography appearance="subdued" typographyType="body-sm">
                  {label}
                </Typography>
              </dt>

              <dd className="text-right">
                <Typography appearance="subdued" title={title} typographyType="body-sm">
                  {value}
                </Typography>
              </dd>
            </div>
          ))}

          <div className="flex gap-1">
            <Button
              appearance="subdued"
              brand="neutral"
              className="grow"
              leftIconPath={mdiImageOutline}
              onClick={() => window.api.shell.openFile(entry.path)}
            >
              {t("single::actions::open")}
            </Button>

            <Button
              appearance="subdued"
              brand="neutral"
              className="grow"
              leftIconPath={mdiFolderOpenOutline}
              onClick={() => window.api.shell.showItemInFolder(entry.path)}
            >
              {t("single::actions::view_in_folder")}
            </Button>
          </div>
        </dl>
      </section>

      <div className="border-b border-b-stroke-subdued/70" />

      <Button leftIconPath={mdiUpload} onClick={startUpload}>
        {t("single::upload::title")}
      </Button>
    </div>
  );
}
