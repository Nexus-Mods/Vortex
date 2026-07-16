import React from "react";
import { useTranslation } from "react-i18next";

import {
  fileWebLinks,
  type IFileActionContext,
  installedToFileData,
} from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import { viewInLoadout } from "@/extensions/health_check/utils/fileRequirements/fileRequirementActions";
import type { IFileRequirement } from "@/extensions/health_check/utils/fileRequirements/mapRequirementsReport";
import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";

import { FileRequirement } from "../FileRequirement";
import { CandidateCard } from "./CandidateCard";

/** Download-replace report: a wrong version is enabled; download a different one. */
export const ReplaceCard = ({
  ctx,
  requirement,
}: {
  ctx: IFileActionContext;
  requirement: Extract<IFileRequirement, { kind: "wrong-version-installed" }>;
}) => {
  const { t } = useTranslation("health_check");
  return (
    <div>
      <Typography appearance="subdued" className="mt-1 mb-2">
        {t("detail::item::installed_version")}
      </Typography>

      <FileRequirement
        actions={
          <Button
            appearance="moderate"
            brand="neutral"
            size="sm"
            onClick={() => viewInLoadout(ctx.api, requirement.installedFile)}
          >
            {t("detail::item::view_in_loadout")}
          </Button>
        }
        file={installedToFileData(requirement.installedFile)}
        {...fileWebLinks(ctx.api, requirement.installedFile)}
      />

      <Typography appearance="subdued" className="mt-4 mb-2">
        {t("detail::item::required_version")}
      </Typography>

      <CandidateCard candidate={requirement.candidate} ctx={ctx} />
    </div>
  );
};
