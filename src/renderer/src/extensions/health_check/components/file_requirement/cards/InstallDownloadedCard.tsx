import { mdiCheck, mdiSwapHorizontal } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import {
  downloadedToFileData,
  fileWebLinks,
  type IFileActionContext,
  type IResolutionContext,
} from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import {
  installDownloadedFile,
  viewDownloadInMods,
} from "@/extensions/health_check/utils/fileRequirements/fileRequirementActions";
import type {
  IDownloadedFile,
  IInstalledFile,
} from "@/extensions/health_check/utils/fileRequirements/installedFiles";
import { Button } from "@/ui/components/button/Button";
import { nxmModOutline } from "@/ui/icon-paths";

import { useInstallButton } from "../../../hooks/useInstallButton";
import { FileRequirement } from "../FileRequirement";

/**
 * An "install this downloaded version" card for one downloaded-but-not-installed file
 * (install-uninstalled rows + OR install branch).
 */
export const InstallDownloadedCard = ({
  ctx,
  file,
  enabledFile,
  resolution,
  isOr,
}: {
  ctx: IFileActionContext;
  file: IDownloadedFile;
  /** The wrong version to switch off, if any; absent means a plain install. */
  enabledFile?: IInstalledFile;
  resolution: IResolutionContext;
  isOr?: boolean;
}) => {
  const { t } = useTranslation("health_check");
  const { isLoading, onClick } = useInstallButton(() =>
    installDownloadedFile(ctx.api, file, ctx.identity, enabledFile),
  );

  // With a wrong version enabled the install is really a version switch, so it reads as one.
  const isSwitch = enabledFile !== undefined;

  const handleInstall = () => {
    ctx.onInstallDownloaded(file, resolution);
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
            leftIconPath={isSwitch ? mdiSwapHorizontal : mdiCheck}
            size="sm"
            onClick={handleInstall}
          >
            {isLoading
              ? t("detail::item::installing")
              : isSwitch
                ? t("detail::item::enable_this_version")
                : t("detail::item::install_uninstalled")}
          </Button>
        </>
      }
      file={downloadedToFileData(file)}
      isOr={isOr}
      {...fileWebLinks(ctx.api, file)}
    />
  );
};
