import React from "react";
import { useTranslation } from "react-i18next";

import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

/** Small "Beta" pill shown next to the health check page titles. */
export const BetaBadge = ({ isSubdued = false }: { isSubdued?: boolean }) => {
  const { t } = useTranslation(["health_check", "common"]);

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
