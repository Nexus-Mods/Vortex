import { mdiCheck } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import {
  downloadedToFileData,
  fileWebLinks,
} from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import {
  installDownloadedFile,
  viewDownloadInMods,
} from "@/extensions/health_check/utils/fileRequirements/fileRequirementActions";
import type { IFileRequirement } from "@/extensions/health_check/utils/fileRequirements/mapRequirementsReport";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { nxmModOutline } from "@/ui/icon-paths";

import { useInstallButton } from "../../../hooks/useInstallButton";
import { FileRequirement } from "../FileRequirement";

export const InstallUninstalledRows = ({
  api,
  requirement,
}: {
  api: IExtensionApi;
  requirement: Extract<IFileRequirement, { kind: "correct-version-uninstalled" }>;
}) => {
  const { t } = useTranslation("health_check");
  const { isLoading, onClick } = useInstallButton(() =>
    installDownloadedFile(api, requirement.uninstalledFile),
  );

  return (
    <FileRequirement
      actions={
        <>
          <Button
            appearance="subdued"
            brand="neutral"
            leftIconPath={nxmModOutline}
            size="sm"
            onClick={() => viewDownloadInMods(api, requirement.uninstalledFile)}
          >
            {t("detail::item::view_in_mods")}
          </Button>

          <Button
            appearance="strong"
            brand="neutral"
            isLoading={isLoading}
            leftIconPath={mdiCheck}
            size="sm"
            onClick={onClick}
          >
            {isLoading ? t("detail::item::installing") : t("detail::item::install_uninstalled")}
          </Button>
        </>
      }
      file={downloadedToFileData(requirement.uninstalledFile)}
      {...fileWebLinks(api, requirement.uninstalledFile)}
    />
  );
};
