import numeral from "numeral";
import React, { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IState } from "@/types/IState";
import { Icon } from "@/ui/components/icon/Icon";
import { AdultAwareImage } from "@/ui/components/image/AdultAwareImage";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";
import { useRelativeTime } from "@/util/useRelativeTime";

import { useModStatus } from "../../../hooks/use_mod_status/useModStatus.hook";
import { ModStatusBadge } from "../mod_status_badge/ModStatusBadge";

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
 * A mod in the list, as the button that opens it in the details pane: pressed while it's open.
 * Its layout is spans, as a button's content has to be. Below `@md` the text drops under the
 * picture, as beside it the text would be too narrow to read. The pressed card has no focus ring,
 * as its pressed look already shows focus; any other card keeps one.
 */
export const ModCard = forwardRef<HTMLButtonElement, IModCardProps>(
  ({ mod, isActive, tabIndex, onSelect }, ref) => {
    const { t } = useTranslation();
    const updatedTime = Date.parse(mod.updated_at);
    const isDated = !Number.isNaN(updatedTime);
    const updated = useRelativeTime(isDated ? updatedTime : undefined, t);
    const { status } = useModStatus(mod);
    const language = useSelector((state: IState) => state.settings.interface.language);
    const updatedAt =
      isDated &&
      new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(
        updatedTime,
      );

    return (
      <button
        aria-pressed={isActive}
        ref={ref}
        className={joinClasses([
          "flex flex-col gap-y-3 overflow-hidden rounded-sm p-2 text-left transition-colors @md:flex-row @md:items-start @md:gap-x-4 @md:pr-4",
          isActive
            ? "bg-surface-translucent-mid inset-ring inset-ring-stroke-weak backdrop-blur-[6.25rem] backdrop-saturate-150 focus-visible:outline-none!"
            : "hover:bg-surface-translucent-low hover:backdrop-blur-[6.25rem]",
        ])}
        data-testid={`mod-card-${mod.id}`}
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
          {!!status && <ModStatusBadge status={status} />}

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
              <Tooltip
                content={t("Downloads: {{total}}", { total: numeral(mod.downloads).format("0,0") })}
              >
                <span className="flex items-center gap-x-1">
                  <Icon name="download" size="sm" />

                  {numeral(mod.downloads).format("0a")}
                </span>
              </Tooltip>

              <Tooltip
                content={t("Endorsements: {{total}}", {
                  total: numeral(mod.endorsements).format("0,0"),
                })}
              >
                <span className="flex items-center gap-x-1">
                  <Icon name="thumb_up" size="sm" />

                  {numeral(mod.endorsements).format("0a")}
                </span>
              </Tooltip>

              {isDated && (
                <Tooltip content={t("Updated {{date}}", { date: updatedAt })}>
                  <span>{updated}</span>
                </Tooltip>
              )}

              {mod.adult && <span>{t("Adult")}</span>}
            </span>
          </Typography>
        </span>
      </button>
    );
  },
);

ModCard.displayName = "ModCard";
