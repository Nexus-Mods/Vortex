import React from "react";
import { useTranslation } from "react-i18next";

import {
  fileWebLinks,
  installedToFileData,
} from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import { viewInLoadout } from "@/extensions/health_check/utils/fileRequirements/fileRequirementActions";
import type { IFileRequirement } from "@/extensions/health_check/utils/fileRequirements/mapRequirementsReport";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";

import { FileRequirement } from "../FileRequirement";
import { EnableCard } from "./EnableCard";

/** Toggle report: the correct version is installed-but-disabled; switch the active version. */
export const ToggleCard = ({
  api,
  requirement,
}: {
  api: IExtensionApi;
  requirement: Extract<IFileRequirement, { kind: "wrong-version-enabled" }>;
}) => {
  const { t } = useTranslation("health_check");
  return (
    <div>
      <Typography appearance="subdued" className="mt-1 mb-2">
        {t("detail::item::enabled_version")}
      </Typography>

      <FileRequirement
        actions={
          <Button
            appearance="moderate"
            brand="neutral"
            size="sm"
            onClick={() => viewInLoadout(api, requirement.enabledFile)}
          >
            {t("detail::item::view_in_loadout")}
          </Button>
        }
        file={installedToFileData(requirement.enabledFile)}
        {...fileWebLinks(api, requirement.enabledFile)}
      />

      <Typography appearance="subdued" className="mt-4 mb-2">
        {t("detail::item::correct_version")}
      </Typography>

      <EnableCard
        api={api}
        correctFile={requirement.correctFile}
        enabledFile={requirement.enabledFile}
      />
    </div>
  );
};
