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

import { FileRequirement } from "../FileRequirement";
import { RequirementGroup } from "../RequirementGroup";

/** Install-uninstalled report: the correct version is downloaded but not installed. */
export const InstallUninstalledGroup = ({
  api,
  requirement,
}: {
  api: IExtensionApi;
  requirement: Extract<IFileRequirement, { kind: "correct-version-uninstalled" }>;
}) => {
  const { t } = useTranslation("health_check");

  return (
    <RequirementGroup title={t("detail::item::install_required")}>
      <FileRequirement
        actions={
          <>
            <Button
              appearance="moderate"
              brand="neutral"
              size="sm"
              onClick={() => viewDownloadInMods(api, requirement.uninstalledFile)}
            >
              {t("detail::item::view_in_mods")}
            </Button>

            <Button
              appearance="strong"
              brand="neutral"
              size="sm"
              onClick={() => void installDownloadedFile(api, requirement.uninstalledFile)}
            >
              {t("detail::item::install_uninstalled")}
            </Button>
          </>
        }
        file={downloadedToFileData(requirement.uninstalledFile)}
        {...fileWebLinks(api, requirement.uninstalledFile)}
      />
    </RequirementGroup>
  );
};
