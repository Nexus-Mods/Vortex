import numeral from "numeral";
import React from "react";
import { useTranslation } from "react-i18next";

import { Author } from "@/ui/components/author/Author";
import { Icon } from "@/ui/components/icon/Icon";
import { AdultAwareImage } from "@/ui/components/image/AdultAwareImage";
import { Pill } from "@/ui/components/pill/Pill";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";
import { useRelativeTime } from "@/util/useRelativeTime";

import { type IStaticMod, MOD_IMAGES } from "../staticMods";

interface IModCardProps {
  /** The mod it shows. */
  mod: IStaticMod;
  /** Whether it's the mod the details pane shows. */
  isActive: boolean;
  /** Its place in the list's Tab order: 0 for the one Tab stop, the selected card, else -1. */
  tabIndex: number;
  /** Shows the mod in the details pane. */
  onSelect: () => void;
}

/**
 * A mod in the list: its picture, tags, name, summary, author and stats. The card is the
 * button that shows it in the details pane, pressed while it's the one the pane shows. Lit on
 * hover, and more so, with its picture dimmed, while pressed. Nothing else in it is
 * interactive, and its layout is spans, as a button's content has to be.
 */
export const ModCard = ({ mod, isActive, tabIndex, onSelect }: IModCardProps) => {
  const { t } = useTranslation();
  const updated = useRelativeTime(new Date(mod.updatedAt).getTime(), t);
  const detailAppearance = isActive ? "moderate" : "subdued";

  return (
    <button
      data-mod-card
      aria-pressed={isActive}
      className={joinClasses([
        "flex items-center gap-x-4 overflow-hidden rounded-sm py-2 pr-4 pl-2 text-left transition-colors",
        isActive
          ? "bg-surface-translucent-mid inset-ring inset-ring-stroke-weak backdrop-blur-[6.25rem] backdrop-saturate-150"
          : "hover:bg-surface-translucent-low hover:backdrop-blur-[6.25rem]",
      ])}
      tabIndex={tabIndex}
      type="button"
      onClick={onSelect}
    >
      <AdultAwareImage
        alt=""
        className="h-30 rounded-sm"
        imageType="mod"
        isAdult={!!mod.isAdult}
        src={`${MOD_IMAGES}/thumbnails/${mod.image}`}
      >
        {isActive && <span className="absolute inset-0 z-5 bg-translucent-dark-300" />}
      </AdultAwareImage>

      <span className="flex min-w-0 flex-1 flex-col justify-between self-stretch py-0.5">
        <span className="flex flex-col gap-y-1.5">
          <span className="-ml-0.5 flex flex-wrap gap-1">
            {mod.isAdult && (
              <Pill brand="danger" icon={{ name: "fiber_manual_record", filled: true }}>
                {t("Adult")}
              </Pill>
            )}

            <Pill>{mod.category}</Pill>
          </span>

          <span className="flex flex-col gap-y-0.5">
            <Typography
              appearance={isActive ? "strong" : "moderate"}
              as="span"
              className="block truncate font-medium"
            >
              {mod.name}
            </Typography>

            <Typography
              appearance={detailAppearance}
              as="span"
              className="line-clamp-2"
              typographyType="body-sm"
            >
              {mod.summary}
            </Typography>
          </span>
        </span>

        <Typography
          appearance={detailAppearance}
          as="span"
          className="flex items-center justify-between gap-x-3"
          typographyType="body-sm"
        >
          <Author className="min-w-0" name={mod.author} />

          <span className="flex shrink-0 items-center gap-x-3">
            <span className="flex items-center gap-x-1">
              <Icon name="download" size="sm" />

              {numeral(mod.downloads).format("0a")}
            </span>

            <span className="flex items-center gap-x-1">
              <Icon name="thumb_up" size="sm" />

              {numeral(mod.endorsements).format("0a")}
            </span>

            <span>{updated}</span>
          </span>
        </Typography>
      </span>
    </button>
  );
};
