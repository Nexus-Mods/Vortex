import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { AdultAwareImage } from "@/ui/components/image/AdultAwareImage";
import { BBCode } from "@/ui/components/prose/bbcode/BBCode";
import { Typography } from "@/ui/components/typography/Typography";

import type { IModPropertiesCard } from "../../hooks/use_mod_properties/useModProperties.hook";
import { ModStatusBadge } from "../mod_status_badge/ModStatusBadge";

interface IModPropertiesCardProps {
  card: IModPropertiesCard;
}

/**
 * The mod as Browse's mod card shows one, heading the Properties panel: its picture with its
 * status tag, its name and summary, its whole description a click away, as the legacy pane has
 * it, then its author and whether it's adult. Its picture blurs as the user has asked, if it's
 * adult; a mod without one shows the broken picture icon, as its row's thumbnail does. The
 * description shows no images from outside Nexus Mods, as there's no room to stand in for them.
 */
export const ModPropertiesCard = ({ card }: IModPropertiesCardProps) => {
  const { t } = useTranslation("mod_management");
  const [showDescription, setShowDescription] = useState(false);

  return (
    <div className="flex flex-col gap-y-4" data-testid="mod-properties-card">
      <AdultAwareImage
        alt=""
        className="w-full rounded-sm border border-stroke-weak"
        fallbackIcon="broken_image"
        fit="cover"
        imageType="mod"
        isAdult={card.isAdult}
        src={card.pictureUrl}
      >
        {!!card.status && <ModStatusBadge status={card.status} />}
      </AdultAwareImage>

      <div className="flex flex-col gap-y-3 pt-0.5">
        <div className="flex flex-col gap-y-1">
          <Typography appearance="moderate" as="h2" className="truncate font-medium">
            {card.name}
          </Typography>

          {!!card.summary && (
            <Typography appearance="subdued" className="leading-5" typographyType="body-sm">
              {card.summary}
            </Typography>
          )}
        </div>

        {!!card.description && (
          <div className="flex flex-col items-start gap-y-2">
            <Button
              appearance="weak"
              brand="neutral"
              data-testid="mod-properties-description-toggle"
              size="sm"
              onClick={() => setShowDescription(!showDescription)}
            >
              {showDescription
                ? t("modsTable::properties::hideDescription")
                : t("modsTable::properties::showDescription")}
            </Button>

            {showDescription && (
              <div className="w-full" data-testid="mod-properties-description">
                <BBCode bbcode={card.description} isFromAdultContent={card.isAdult} size="sm" />
              </div>
            )}
          </div>
        )}

        {(!!card.author || card.isAdult) && (
          <Typography
            appearance="subdued"
            as="div"
            className="flex items-center justify-between gap-x-3"
            data-testid="mod-properties-card-footer"
            typographyType="body-sm"
          >
            <span className="min-w-0 truncate">
              {!!card.author && t("modsTable::properties::byAuthor", { author: card.author })}
            </span>

            {card.isAdult && <span className="shrink-0">{t("modsTable::properties::adult")}</span>}
          </Typography>
        )}
      </div>
    </div>
  );
};
