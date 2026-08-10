import { mdiMonitorArrowDownVariant } from "@mdi/js";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import type { IFileActionContext } from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import { downloadFileRequirement } from "@/extensions/health_check/utils/fileRequirements/fileRequirementActions";
import {
  canQuickInstall,
  downloadTargets,
  type FileRequirementCategory,
  type IFileRequirementReport,
} from "@/extensions/health_check/utils/fileRequirements/fileRequirementReport";
import type { IFileRequirement } from "@/extensions/health_check/utils/fileRequirements/mapRequirementsReport";
import { sharedRequirementState } from "@/extensions/health_check/utils/shared/tracking";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";

import { Divider } from "../divider/Divider";
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
      return "detail::item::enable_required";
    case "or":
      return "detail::item::pick_one";
  }
};

const requirementRows = (requirement: IFileRequirement, ctx: IFileActionContext) => {
  switch (requirement.kind) {
    case "missing":
      return <DownloadRows ctx={ctx} requirement={requirement} />;
    case "wrong-version-installed":
      return <ReplaceRows ctx={ctx} requirement={requirement} />;
    case "correct-version-uninstalled":
      return <InstallUninstalledRows ctx={ctx} requirement={requirement} />;
    case "wrong-version-enabled":
      return <ToggleRows ctx={ctx} requirement={requirement} />;
    case "or":
      return <OrRows ctx={ctx} requirement={requirement} />;
  }
};

export const RequirementBody = ({
  report,
  ctx,
  api,
}: {
  report: IFileRequirementReport;
  ctx: IFileActionContext;
  api: IExtensionApi;
}) => {
  const { identity } = ctx;
  const { t } = useTranslation("health_check");
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const title = t(groupTitleKey(report.category));
  const { requirements } = report;

  const installAllTargets = canQuickInstall(report.category) ? downloadTargets(requirements) : [];

  const hasInstallAll = installAllTargets.length > 1;

  // While "install all" runs, every card's install button also shows loading.
  const rowCtx: IFileActionContext = {
    ...ctx,
    installButtonAppearance: hasInstallAll ? "moderate" : "strong",
    isDownloadingAll: downloadingAll,
  };

  const runInstallAll = () => {
    setDownloadingAll(true);
    void Promise.all(
      installAllTargets.map((target) =>
        downloadFileRequirement(api, target.candidate, identity, target.enabledFile),
      ),
    ).then((results) => {
      // On full success the requirements clear and this view unmounts; only reset
      // when something failed and the buttons are still around.
      if (results.some((ok) => !ok)) {
        setDownloadingAll(false);
      }
    });
  };

  const installAll = () => {
    ctx.onInstallAll(
      installAllTargets.map((target) => target.candidate),
      sharedRequirementState(requirements),
    );
    if (ctx.showPremiumAd) {
      setPremiumOpen(true);
      return;
    }
    runInstallAll();
  };

  const installAllAction = hasInstallAll && (
    <Button
      appearance="strong"
      brand="neutral"
      isLoading={downloadingAll}
      leftIconPath={mdiMonitorArrowDownVariant}
      rightIcon={ctx.showPremiumAd ? <PremiumBadge /> : undefined}
      size="sm"
      onClick={installAll}
    >
      {downloadingAll
        ? t("detail::item::downloading")
        : t("actions::install_all", { count: installAllTargets.length })}
    </Button>
  );

  return (
    <>
      {isCollapsed(report.category) ? (
        <RequirementGroup actions={installAllAction} title={title}>
          {requirements.map((requirement) => (
            <React.Fragment key={requirement.requirementDefId}>
              {requirementRows(requirement, rowCtx)}
            </React.Fragment>
          ))}
        </RequirementGroup>
      ) : (
        requirements.map((requirement, index) => (
          <React.Fragment key={requirement.requirementDefId}>
            {index > 0 && <Divider className="h-9.5" variant="and" />}

            <RequirementGroup actions={index === 0 ? installAllAction : undefined} title={title}>
              {requirementRows(requirement, rowCtx)}
            </RequirementGroup>
          </React.Fragment>
        ))
      )}

      <PremiumModal
        api={api}
        downloadScope="all"
        isOpen={premiumOpen}
        modCount={installAllTargets.length}
        trigger="batch_install"
        onClose={() => setPremiumOpen(false)}
        onDownload={() => setPremiumOpen(false)}
        onPremiumUnlocked={runInstallAll}
      />
    </>
  );
};
