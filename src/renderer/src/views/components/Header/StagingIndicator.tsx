import React, { type FC } from "react";
import { useTranslation } from "react-i18next";

import { Pill } from "../../../ui/components/pill/Pill";

export const StagingIndicator: FC = () => {
  const { t } = useTranslation();

  if (process.env.IS_VORTEX_PREVIEW !== "true") {
    return null;
  }

  return <Pill pillType="success">{t("STAGING")}</Pill>;
};
