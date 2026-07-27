import React from "react";
import { useTranslation } from "react-i18next";

import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

interface IDividerProps {
  variant: "and" | "or";
  className?: string;
}

export const Divider = ({ variant, className }: IDividerProps) => {
  const { t } = useTranslation("health_check");

  return (
    <div aria-hidden className={joinClasses(["flex items-center gap-x-3", className])}>
      <div className="h-px w-3 bg-surface-mid" />

      <Typography as="div" className="font-semibold">
        {t(`divider::${variant}`)}
      </Typography>

      <div className="h-px grow bg-surface-mid" />
    </div>
  );
};
