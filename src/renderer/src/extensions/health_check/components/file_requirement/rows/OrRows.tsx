import React from "react";

import type { IFileActionContext } from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import type {
  IFileRequirement,
  IFileRequirementBranch,
} from "@/extensions/health_check/utils/fileRequirements/mapRequirementsReport";

import { CandidateCard } from "../cards/CandidateCard";
import { EnableCard } from "../cards/EnableCard";
import { InstallDownloadedCard } from "../cards/InstallDownloadedCard";

/** The card for one OR alternative, by the action picking it needs. */
const branchCard = (
  branch: IFileRequirementBranch,
  ctx: IFileActionContext,
  optionPosition: number,
  optionCount: number,
) => {
  switch (branch.kind) {
    case "download":
      return (
        <CandidateCard
          candidate={branch.candidate}
          ctx={ctx}
          isOr={true}
          optionCount={optionCount}
          optionPosition={optionPosition}
        />
      );
    case "install":
      return (
        <InstallDownloadedCard
          ctx={ctx}
          enabledFile={branch.enabledFile}
          file={branch.uninstalledFile}
          isOr={true}
        />
      );
    case "enable":
      return (
        <EnableCard
          correctFile={branch.correctFile}
          ctx={ctx}
          enabledFile={branch.enabledFile}
          isOr={true}
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
    {requirement.branches.map((branch, index) => (
      <React.Fragment key={branch.modFileId}>
        {branchCard(branch, ctx, index + 1, requirement.branches.length)}
      </React.Fragment>
    ))}
  </>
);
