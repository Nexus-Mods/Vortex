import React from "react";

import type { IFileActionContext } from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import type { IFileRequirement } from "@/extensions/health_check/utils/fileRequirements/mapRequirementsReport";

import { CandidateCard } from "../cards/CandidateCard";
import { EnableCard } from "../cards/EnableCard";

export const OrRows = ({
  ctx,
  requirement,
}: {
  ctx: IFileActionContext;
  requirement: Extract<IFileRequirement, { kind: "or" }>;
}) => (
  <>
    {requirement.branches.map((branch) =>
      branch.kind === "download" ? (
        <CandidateCard candidate={branch.candidate} ctx={ctx} isOr={true} key={branch.modFileId} />
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
  </>
);
