import React from "react";
import { useTranslation } from "react-i18next";

import { Bullet } from "@/ui/components/bullet/Bullet";
import { Typography } from "@/ui/components/typography/Typography";

import type { InstallState } from "../types";

/** "Installed" / "Update available" marker; renders nothing for mods that aren't installed. */
export const InstallStateLabel = ({ state }: { state: InstallState }) => {
  const { t } = useTranslation(["common"]);
  if (state === "not-installed") {
    return null;
  }
  return (
    <>
      <Bullet />

      <Typography
        brand={state === "update-available" ? "warning" : "success"}
        data-testid="catalog-install-state"
        typographyType="body-sm"
      >
        {state === "update-available" ? t("Update available") : t("Installed")}
      </Typography>
    </>
  );
};
