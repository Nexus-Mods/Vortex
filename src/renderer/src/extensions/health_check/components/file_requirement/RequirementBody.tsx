import React from "react";

import type { IFileActionContext } from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import type { RequirementJoin } from "@/extensions/health_check/utils/fileRequirements/fileRequirementReport";
import type { IFileRequirement } from "@/extensions/health_check/utils/fileRequirements/mapRequirementsReport";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { Typography } from "@/ui/components/typography/Typography";

import { RequirementGroup } from "./RequirementGroup";
import { DownloadRows } from "./rows/DownloadRows";
import { InstallUninstalledRows } from "./rows/InstallUninstalledRows";
import { OrRows } from "./rows/OrRows";
import { ReplaceRows } from "./rows/ReplaceRows";
import { ToggleRows } from "./rows/ToggleRows";

const requirementRows = (
  requirement: IFileRequirement,
  ctx: IFileActionContext,
  api: IExtensionApi,
) => {
  switch (requirement.kind) {
    case "missing":
      return <DownloadRows ctx={ctx} requirement={requirement} />;
    case "wrong-version-installed":
      return <ReplaceRows ctx={ctx} requirement={requirement} />;
    case "correct-version-uninstalled":
      return <InstallUninstalledRows api={api} requirement={requirement} />;
    case "wrong-version-enabled":
      return <ToggleRows api={api} requirement={requirement} />;
    case "or":
      return <OrRows ctx={ctx} requirement={requirement} />;
  }
};

const AndDivider = () => (
  <div aria-hidden className="flex h-9.5 items-center gap-x-3">
    <div className="h-px w-3 bg-surface-mid" />

    <Typography as="div" className="font-semibold">
      And
    </Typography>

    <div className="h-px grow bg-surface-mid" />
  </div>
);

export const RequirementBody = ({
  title,
  join,
  requirements,
  ctx,
  api,
}: {
  title: string;
  join: RequirementJoin;
  requirements: IFileRequirement[];
  ctx: IFileActionContext;
  api: IExtensionApi;
}) => {
  if (join === "collapse") {
    return (
      <RequirementGroup title={title}>
        {requirements.map((requirement) => (
          <React.Fragment key={requirement.requirementDefId}>
            {requirementRows(requirement, ctx, api)}
          </React.Fragment>
        ))}
      </RequirementGroup>
    );
  }

  return (
    <>
      {requirements.map((requirement, index) => (
        <React.Fragment key={requirement.requirementDefId}>
          {index > 0 && <AndDivider />}

          <RequirementGroup title={title}>
            {requirementRows(requirement, ctx, api)}
          </RequirementGroup>
        </React.Fragment>
      ))}
    </>
  );
};
