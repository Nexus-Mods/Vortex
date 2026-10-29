import numeral from "numeral";
import React from "react";
import { useTranslation } from "react-i18next";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { Icon } from "@/ui/components/icon/Icon";
import { AdultAwareImage } from "@/ui/components/image/AdultAwareImage";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";
import { useRelativeTime } from "@/util/useRelativeTime";

interface IModCardProps {
  /** The mod it shows. */
  mod: ModSummary;
  /** Whether it's the mod the details pane shows. */
  isActive: boolean;
  /** Its place in the list's Tab order: 0 for the one Tab stop, the selected card, else -1. */
  tabIndex: number;
  /** Shows the mod in the details pane. */
  onSelect: () => void;
}

/**
 * A mod in the list: its picture, then its name, its whole summary, and a line of who uploaded
 * it, its stats and whether it's adult, held to the bottom. The card is the button that shows it
 * in the details pane, pressed while it's the one the pane shows. Lit on hover, and more so,
 * with its picture dimmed and its name and summary brighter, while pressed. Nothing else in it
 * is interactive, and its layout is spans, as a button's content has to be. Beside the text the
 * picture takes two fifths of the card, up to 242px wide, so it shrinks before the text has to;
 * in a list narrower than `@md`, the text drops below it instead, as beside it the text would be
 * too narrow to read. The footer wraps rather than cutting its stats off.
 */
export const ModCard = ({ mod, isActive, tabIndex, onSelect }: IModCardProps) => {
  const { t } = useTranslation();
  const updated = useRelativeTime(new Date(mod.updated_at).getTime(), t);

  return (
    <button
      data-mod-card
      aria-pressed={isActive}
      className={joinClasses([
        "flex flex-col gap-y-3 overflow-hidden rounded-sm p-2 text-left transition-colors @md:flex-row @md:items-start @md:gap-x-4 @md:pr-4",
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
        blurredSrc={mod.blurred_thumbnail_url}
        className="w-full shrink-0 rounded-sm @md:w-2/5 @md:max-w-60.5"
        imageType="mod"
        isAdult={mod.adult}
        src={mod.thumbnail_url}
      >
        {isActive && <span className="absolute inset-0 z-5 bg-translucent-dark-300" />}
      </AdultAwareImage>

      <span className="flex min-w-0 flex-1 flex-col gap-y-3 self-stretch pt-0.5">
        <span className="flex flex-col gap-y-1">
          <Typography
            appearance={isActive ? "strong" : "moderate"}
            as="span"
            className="block truncate font-medium"
          >
            {mod.name}
          </Typography>

          <Typography
            appearance={isActive ? "moderate" : "subdued"}
            as="span"
            className="block leading-5"
            typographyType="body-sm"
          >
            {mod.summary}
          </Typography>
        </span>

        <Typography
          appearance="subdued"
          as="span"
          className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
          typographyType="body-sm"
        >
          <span className="min-w-0 truncate">
            {t("by {{author}}", { author: mod.author.name })}
          </span>

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

            {mod.adult && <span>{t("Adult")}</span>}
          </span>
        </Typography>
      </span>
    </button>
  );
};
