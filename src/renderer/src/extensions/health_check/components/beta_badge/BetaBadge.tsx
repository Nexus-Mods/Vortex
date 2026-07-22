import React from "react";
import { useTranslation } from "react-i18next";

import { Typography } from "@/ui/components/typography/Typography";

/** Small "Beta" pill shown next to the health check page titles. */
export const BetaBadge = () => {
  const { t } = useTranslation(["health_check", "common"]);

  return (
    <Typography
      as="div"
      className="flex min-h-4 items-center justify-center rounded-sm border border-neutral-strong px-1"
      typographyType="title-xs"
    >
      {t("common:::beta")}
    </Typography>
  );
};
