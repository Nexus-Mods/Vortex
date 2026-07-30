import { mdiMonitorArrowDownVariant, mdiOpenInNew } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import {
  candidateToFileData,
  fileWebLinks,
  type IFileActionContext,
  type IResolutionContext,
} from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import { openModPage } from "@/extensions/health_check/utils/fileRequirements/fileRequirementActions";
import type { IFileRequirementCandidate } from "@/extensions/health_check/utils/fileRequirements/mapRequirementsReport";
import { Button } from "@/ui/components/button/Button";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";

import { useInstallButton } from "../../../hooks/useInstallButton";
import { FileRequirement } from "../FileRequirement";

/** A download/enable card for one candidate (used by download + OR cards). */
export const CandidateCard = ({
  ctx,
  candidate,
  resolution,
  isOr,
}: {
  ctx: IFileActionContext;
  candidate: IFileRequirementCandidate;
  resolution: IResolutionContext;
  isOr?: boolean;
}) => {
  const { t } = useTranslation(["health_check", "common"]);

  const { isLoading, onClick } = useInstallButton(
    () => ctx.requestDownload(candidate),
    ctx.showPremiumAd,
  );

  const loading = isLoading || !!ctx.isDownloadingAll;

  const handleInstall = () => {
    ctx.onInstall(candidate, resolution);
    onClick();
  };

  const handleModPage = () => {
    ctx.onOpenModPage(candidate, resolution);
    openModPage(ctx.api, candidate);
  };

  return (
    <FileRequirement
      actions={
        <>
          <Button
            appearance="subdued"
            brand="neutral"
            leftIconPath={mdiOpenInNew}
            size="sm"
            onClick={handleModPage}
          >
            {t("detail::item::install_via_mod_page")}
          </Button>

          <Button
            appearance={ctx.installButtonAppearance ?? "strong"}
            brand="neutral"
            isLoading={loading}
            leftIconPath={mdiMonitorArrowDownVariant}
            rightIcon={ctx.showPremiumAd ? <PremiumBadge /> : undefined}
            size="sm"
            onClick={handleInstall}
          >
            {loading ? t("detail::item::downloading") : t("detail::item::install_one_click")}
          </Button>
        </>
      }
      file={candidateToFileData(candidate)}
      isOr={isOr}
      {...fileWebLinks(ctx.api, candidate)}
    />
  );
};
