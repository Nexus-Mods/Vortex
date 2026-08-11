import { mdiSwapHorizontal } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import {
  fileWebLinks,
  type IFileActionContext,
  type IResolutionContext,
  installedToFileData,
} from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import {
  enableInstalledFile,
  switchActiveVersion,
  viewInLoadout,
} from "@/extensions/health_check/utils/fileRequirements/fileRequirementActions";
import type { IInstalledFile } from "@/extensions/health_check/utils/fileRequirements/installedFiles";
import { Button } from "@/ui/components/button/Button";
import { nxmModOutline } from "@/ui/icon-paths";

import { FileRequirement } from "../FileRequirement";

/** A "switch to this disabled version" card for one installed file (toggle + OR enable). */
export const EnableCard = ({
  ctx,
  correctFile,
  enabledFile,
  resolution,
  isOr,
}: {
  ctx: IFileActionContext;
  correctFile: IInstalledFile;
  /** The wrong version to switch off, if any; absent means a plain enable. */
  enabledFile?: IInstalledFile;
  resolution: IResolutionContext;
  isOr?: boolean;
}) => {
  const { t } = useTranslation("health_check");

  const handleViewInMods = () => {
    ctx.onViewInMods(correctFile);
    viewInLoadout(ctx.api, correctFile);
  };

  const handleEnable = () => {
    ctx.onEnable(correctFile, enabledFile, resolution);

    if (enabledFile) {
      switchActiveVersion(ctx.api, enabledFile, correctFile);
    } else {
      enableInstalledFile(ctx.api, correctFile);
    }
  };

  return (
    <FileRequirement
      actions={
        <>
          <Button
            appearance="subdued"
            brand="neutral"
            leftIconPath={nxmModOutline}
            onClick={handleViewInMods}
          >
            {t("detail::item::view_in_mods")}
          </Button>

          <Button
            appearance="strong"
            brand="neutral"
            leftIconPath={mdiSwapHorizontal}
            onClick={handleEnable}
          >
            {t("detail::item::enable_this_version")}
          </Button>
        </>
      }
      file={installedToFileData(correctFile)}
      isOr={isOr}
      {...fileWebLinks(ctx.api, correctFile)}
    />
  );
};
