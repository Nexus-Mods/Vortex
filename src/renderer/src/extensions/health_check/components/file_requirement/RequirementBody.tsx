import { mdiMonitorArrowDownVariant } from "@mdi/js";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import type { IFileActionContext } from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import { downloadFileRequirement } from "@/extensions/health_check/utils/fileRequirements/fileRequirementActions";
import {
  canQuickInstall,
  downloadCandidates,
  type FileRequirementCategory,
  type IFileRequirementReport,
} from "@/extensions/health_check/utils/fileRequirements/fileRequirementReport";
import type { IFileRequirement } from "@/extensions/health_check/utils/fileRequirements/mapRequirementsReport";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";
import { Typography } from "@/ui/components/typography/Typography";

import { PremiumModal } from "../premium_modal/PremiumModal";
import { RequirementGroup } from "./RequirementGroup";
import { DownloadRows } from "./rows/DownloadRows";
import { InstallUninstalledRows } from "./rows/InstallUninstalledRows";
import { OrRows } from "./rows/OrRows";
import { ReplaceRows } from "./rows/ReplaceRows";
import { ToggleRows } from "./rows/ToggleRows";

const isCollapsed = (category: FileRequirementCategory): boolean =>
  category === "download" || category === "install-uninstalled";

const groupTitleKey = (category: FileRequirementCategory): string => {
  switch (category) {
    case "download":
    case "install-uninstalled":
      return "detail::item::install_required";
    case "download-replace":
      return "detail::item::different_version_required";
    case "toggle":
      return "detail::item::enabled_version";
    case "or":
      return "detail::item::pick_one";
  }
};

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
  report,
  ctx,
  api,
}: {
  report: IFileRequirementReport;
  ctx: IFileActionContext;
  api: IExtensionApi;
}) => {
  const { t } = useTranslation("health_check");
  const [premiumOpen, setPremiumOpen] = useState(false);

  const title = t(groupTitleKey(report.category));
  const { requirements } = report;

  const installAllCandidates = canQuickInstall(report.category)
    ? downloadCandidates(requirements)
    : [];

  const hasInstallAll = installAllCandidates.length > 1;

  const rowCtx: IFileActionContext = {
    ...ctx,
    installButtonAppearance: hasInstallAll ? "moderate" : "strong",
  };

  const installAll = () => {
    if (ctx.showPremiumAd) {
      setPremiumOpen(true);
      return;
    }
    installAllCandidates.forEach((candidate) => void downloadFileRequirement(api, candidate));
  };

  const installAllAction = hasInstallAll && (
    <Button
      appearance="strong"
      brand="neutral"
      leftIconPath={mdiMonitorArrowDownVariant}
      rightIcon={ctx.showPremiumAd ? <PremiumBadge /> : undefined}
      size="sm"
      onClick={installAll}
    >
      {t("actions::install_all", { count: installAllCandidates.length })}
    </Button>
  );

  return (
    <>
      {isCollapsed(report.category) ? (
        <RequirementGroup actions={installAllAction} title={title}>
          {requirements.map((requirement) => (
            <React.Fragment key={requirement.requirementDefId}>
              {requirementRows(requirement, rowCtx, api)}
            </React.Fragment>
          ))}
        </RequirementGroup>
      ) : (
        requirements.map((requirement, index) => (
          <React.Fragment key={requirement.requirementDefId}>
            {index > 0 && <AndDivider />}

            <RequirementGroup actions={index === 0 ? installAllAction : undefined} title={title}>
              {requirementRows(requirement, rowCtx, api)}
            </RequirementGroup>
          </React.Fragment>
        ))
      )}

      <PremiumModal
        downloadScope="all"
        isOpen={premiumOpen}
        onClose={() => setPremiumOpen(false)}
        onDownload={() => setPremiumOpen(false)}
      />
    </>
  );
};
