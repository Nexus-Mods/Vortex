import React from "react";

import type { IFileActionContext } from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import type { IFileRequirement } from "@/extensions/health_check/utils/fileRequirements/mapRequirementsReport";

import { CandidateCard } from "../cards/CandidateCard";

export const DownloadRows = ({
  ctx,
  requirement,
}: {
  ctx: IFileActionContext;
  requirement: Extract<IFileRequirement, { kind: "missing" }>;
}) => <CandidateCard candidate={requirement.candidate} ctx={ctx} />;
