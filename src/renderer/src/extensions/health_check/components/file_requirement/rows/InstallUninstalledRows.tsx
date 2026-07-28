import { mdiCheck } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import {
  downloadedToFileData,
  fileWebLinks,
  type IFileActionContext,
} from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import {
  installDownloadedFile,
  viewDownloadInMods,
} from "@/extensions/health_check/utils/fileRequirements/fileRequirementActions";
import type { IFileRequirement } from "@/extensions/health_check/utils/fileRequirements/mapRequirementsReport";
import { Button } from "@/ui/components/button/Button";
import { nxmModOutline } from "@/ui/icon-paths";

import { useInstallButton } from "../../../hooks/useInstallButton";
import { FileRequirement } from "../FileRequirement";

export const InstallUninstalledRows = ({
  ctx,
  requirement,
}: {
  ctx: IFileActionContext;
  requirement: Extract<IFileRequirement, { kind: "correct-version-uninstalled" }>;
}) => {
  const { t } = useTranslation("health_check");
  const file = requirement.uninstalledFile;
  const { isLoading, onClick } = useInstallButton(() =>
    installDownloadedFile(ctx.api, file, { issueId: ctx.issueId, checkId: ctx.checkId }),
  );

  const handleInstall = () => {
    ctx.onInstallDownloaded(file);
    onClick();
  };

  const handleViewInMods = () => {
    ctx.onViewInMods(file);
    viewDownloadInMods(ctx.api, file);
  };

  return (
    <FileRequirement
      actions={
        <>
          <Button
            appearance="subdued"
            brand="neutral"
            leftIconPath={nxmModOutline}
            size="sm"
            onClick={handleViewInMods}
          >
            {t("detail::item::view_in_mods")}
          </Button>

          <Button
            appearance="strong"
            brand="neutral"
            isLoading={isLoading}
            leftIconPath={mdiCheck}
            size="sm"
            onClick={handleInstall}
          >
            {isLoading ? t("detail::item::installing") : t("detail::item::install_uninstalled")}
          </Button>
        </>
      }
      file={downloadedToFileData(file)}
      {...fileWebLinks(ctx.api, file)}
    />
  );
};
