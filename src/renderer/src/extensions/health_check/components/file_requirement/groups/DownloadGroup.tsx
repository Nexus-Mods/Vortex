import React from "react";
import { useTranslation } from "react-i18next";

import type { IFileActionContext } from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import type { IFileRequirement } from "@/extensions/health_check/utils/fileRequirements/mapRequirementsReport";

import { CandidateCard } from "../cards/CandidateCard";
import { RequirementGroup } from "../RequirementGroup";

/** Download report: each requirement is a single missing file to download. */
export const DownloadGroup = ({
  ctx,
  requirement,
}: {
  ctx: IFileActionContext;
  requirement: Extract<IFileRequirement, { kind: "missing" }>;
}) => {
  const { t } = useTranslation("health_check");

  return (
    <RequirementGroup title={t("detail::item::install_required")}>
      <CandidateCard candidate={requirement.candidate} ctx={ctx} />
    </RequirementGroup>
  );
};
