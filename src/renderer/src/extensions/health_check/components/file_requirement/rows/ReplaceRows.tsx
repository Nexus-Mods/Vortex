import React from "react";
import { useTranslation } from "react-i18next";

import {
  type IFileActionContext,
  installedToFileData,
} from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import { viewInLoadout } from "@/extensions/health_check/utils/fileRequirements/fileRequirementActions";
import type { IFileRequirement } from "@/extensions/health_check/utils/fileRequirements/mapRequirementsReport";
import { requirementStateFor } from "@/extensions/health_check/utils/shared/tracking";
import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";
import { nxmModOutline } from "@/ui/icon-paths";

import { CandidateCard } from "../cards/CandidateCard";
import { FileRequirement } from "../FileRequirement";

export const ReplaceRows = ({
  ctx,
  requirement,
}: {
  ctx: IFileActionContext;
  requirement: Extract<IFileRequirement, { kind: "wrong-version-installed" }>;
}) => {
  const { t } = useTranslation("health_check");

  const handleViewInMods = () => {
    ctx.onViewInMods(requirement.installedFile);
    viewInLoadout(ctx.api, requirement.installedFile);
  };

  return (
    <>
      <div className="space-y-3 border-b border-surface-mid pb-6">
        <Typography appearance="subdued" className="px-6 font-semibold" typographyType="body-sm">
          {t("detail::item::required_version")}
        </Typography>

        <CandidateCard
          candidate={requirement.candidate}
          ctx={ctx}
          enabledFile={requirement.installedFile}
          resolution={{ requirementState: requirementStateFor(requirement) }}
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
              onClick={handleViewInMods}
            >
              {t("detail::item::view_in_mods")}
            </Button>
          }
          file={installedToFileData(requirement.installedFile)}
          showMod={false}
        />
      </div>
    </>
  );
};
