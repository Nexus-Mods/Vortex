import React from "react";
import { useTranslation } from "react-i18next";

import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

/** Small "Beta" pill shown next to the page titles. */
export const BetaBadge = ({ isSubdued = false }: { isSubdued?: boolean }) => {
  const { t } = useTranslation(["media_page", "common"]);

  return (
    <Typography
      appearance={isSubdued ? "subdued" : "strong"}
      as="div"
      className={joinClasses([
        "flex min-h-4 items-center justify-center rounded-sm border px-1 transition-colors",
        isSubdued ? "border-neutral-subdued" : "border-neutral-strong",
      ])}
      typographyType="title-xs"
    >
      {t("common:::beta")}
    </Typography>
  );
};
