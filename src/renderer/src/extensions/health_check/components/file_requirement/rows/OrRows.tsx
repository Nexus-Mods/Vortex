import React from "react";

import type {
  IFileActionContext,
  IResolutionContext,
} from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import type {
  IFileRequirement,
  IFileRequirementBranch,
} from "@/extensions/health_check/utils/fileRequirements/mapRequirementsReport";
import { branchRequirementState } from "@/extensions/health_check/utils/shared/tracking";

import { CandidateCard } from "../cards/CandidateCard";
import { EnableCard } from "../cards/EnableCard";
import { InstallDownloadedCard } from "../cards/InstallDownloadedCard";

/** The card for one OR alternative, by the action picking it needs. */
const branchCard = (
  branch: IFileRequirementBranch,
  ctx: IFileActionContext,
  resolution: IResolutionContext,
) => {
  switch (branch.kind) {
    case "download":
      return (
        <CandidateCard
          candidate={branch.candidate}
          ctx={ctx}
          enabledFile={branch.enabledFile}
          isOr={true}
          resolution={resolution}
        />
      );
    case "install":
      return (
        <InstallDownloadedCard
          ctx={ctx}
          enabledFile={branch.enabledFile}
          file={branch.uninstalledFile}
          isOr={true}
          resolution={resolution}
        />
      );
    case "enable":
      return (
        <EnableCard
          correctFile={branch.correctFile}
          ctx={ctx}
          enabledFile={branch.enabledFile}
          isOr={true}
          resolution={resolution}
        />
      );
  }
};

export const OrRows = ({
  ctx,
  requirement,
}: {
  ctx: IFileActionContext;
  requirement: Extract<IFileRequirement, { kind: "or" }>;
}) => (
  <>
    {requirement.branches.map((branch) => (
      <React.Fragment key={branch.modFileId}>
        {branchCard(branch, ctx, {
          requirementState: branchRequirementState(branch),
          optionCount: requirement.branches.length,
        })}
      </React.Fragment>
    ))}
  </>
);
