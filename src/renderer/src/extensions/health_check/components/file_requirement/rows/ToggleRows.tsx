import React from "react";
import { useTranslation } from "react-i18next";

import { installedToFileData } from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import { viewInLoadout } from "@/extensions/health_check/utils/fileRequirements/fileRequirementActions";
import type { IFileRequirement } from "@/extensions/health_check/utils/fileRequirements/mapRequirementsReport";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";
import { nxmModOutline } from "@/ui/icon-paths";

import { EnableCard } from "../cards/EnableCard";
import { FileRequirement } from "../FileRequirement";

export const ToggleRows = ({
  api,
  requirement,
}: {
  api: IExtensionApi;
  requirement: Extract<IFileRequirement, { kind: "wrong-version-enabled" }>;
}) => {
  const { t } = useTranslation("health_check");

  return (
    <>
      <div className="space-y-3 border-b border-surface-mid pb-6">
        <Typography appearance="subdued" className="px-6 font-semibold" typographyType="body-sm">
          {t("detail::item::required_version")}
        </Typography>

        <EnableCard
          api={api}
          correctFile={requirement.correctFile}
          enabledFile={requirement.enabledFile}
        />
      </div>

      <div className="space-y-3 pt-6">
        <Typography appearance="subdued" className="px-6 font-semibold" typographyType="body-sm">
          {t("detail::item::current_version")}
        </Typography>

        <FileRequirement
          actions={
            <Button
              appearance="subdued"
              brand="neutral"
              leftIconPath={nxmModOutline}
              size="sm"
              onClick={() => viewInLoadout(api, requirement.enabledFile)}
            >
              {t("detail::item::view_in_mods")}
            </Button>
          }
          file={installedToFileData(requirement.enabledFile)}
          showMod={false}
        />
      </div>
    </>
  );
};
