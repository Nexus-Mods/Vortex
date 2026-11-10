import React from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "@/ui/components/icon/Icon";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

import { type ModStatus, modStatusDisplay } from "../../../util/mod_status/modStatus";

interface IModStatusBadgeProps {
  /** The status it shows. */
  status: ModStatus;
}

/**
 * A mod card's status, as a tab hanging from the top of its picture, above the picture's dimming
 * once the card's picked: blue for an update.
 */
export const ModStatusBadge = ({ status }: IModStatusBadgeProps) => {
  const { t } = useTranslation();
  const { label, icon } = modStatusDisplay(t, status);

  return (
    <span
      className={joinClasses([
        "absolute top-0 left-2 z-6 flex h-6 items-center gap-x-0.5 rounded-b px-1 shadow-sm",
        status === "update" ? "bg-info-moderate" : "bg-neutral-strong",
      ])}
    >
      <Icon className="text-neutral-inverted" name={icon} size="sm" />

      <Typography appearance="inverted" as="span" className="px-0.5" typographyType="body-sm">
        {label}
      </Typography>
    </span>
  );
};
