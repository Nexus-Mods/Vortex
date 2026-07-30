import React from "react";

import type { IFileActionContext } from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import type { IFileRequirement } from "@/extensions/health_check/utils/fileRequirements/mapRequirementsReport";
import { requirementStateFor } from "@/extensions/health_check/utils/shared/tracking";

import { InstallDownloadedCard } from "../cards/InstallDownloadedCard";

export const InstallUninstalledRows = ({
  ctx,
  requirement,
}: {
  ctx: IFileActionContext;
  requirement: Extract<IFileRequirement, { kind: "correct-version-uninstalled" }>;
}) => (
  <InstallDownloadedCard
    ctx={ctx}
    enabledFile={requirement.enabledFile}
    file={requirement.uninstalledFile}
    resolution={{ requirementState: requirementStateFor(requirement) }}
  />
);
