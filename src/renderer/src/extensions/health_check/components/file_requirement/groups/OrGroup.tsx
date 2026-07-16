import React from "react";
import { useTranslation } from "react-i18next";

import type { IFileActionContext } from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import type { IFileRequirement } from "@/extensions/health_check/utils/fileRequirements/mapRequirementsReport";

import { CandidateCard } from "../cards/CandidateCard";
import { EnableCard } from "../cards/EnableCard";
import { RequirementGroup } from "../RequirementGroup";

/** OR report: pick one alternative. Each branch is a download or an enable/switch action. */
export const OrGroup = ({
  ctx,
  requirement,
}: {
  ctx: IFileActionContext;
  requirement: Extract<IFileRequirement, { kind: "or" }>;
}) => {
  const { t } = useTranslation("health_check");

  return (
    <RequirementGroup title={t("detail::item::pick_one")}>
      {requirement.branches.map((branch) =>
        branch.kind === "download" ? (
          <CandidateCard
            candidate={branch.candidate}
            ctx={ctx}
            isOr={true}
            key={branch.modFileId}
          />
        ) : (
          <EnableCard
            api={ctx.api}
            correctFile={branch.correctFile}
            enabledFile={branch.enabledFile}
            isOr={true}
            key={branch.modFileId}
          />
        ),
      )}
    </RequirementGroup>
  );
};
