import { mdiMonitorArrowDownVariant, mdiOpenInNew } from "@mdi/js";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  candidateToFileData,
  fileWebLinks,
  type IFileActionContext,
  type IResolutionContext,
} from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import {
  openFilePage,
  openModPage,
} from "@/extensions/health_check/utils/fileRequirements/fileRequirementActions";
import type { IInstalledFile } from "@/extensions/health_check/utils/fileRequirements/installedFiles";
import type { IFileRequirementCandidate } from "@/extensions/health_check/utils/fileRequirements/mapRequirementsReport";
import { decodeUID } from "@/extensions/nexus_integration/util/UIDs";
import { Button } from "@/ui/components/button/Button";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";

import { useInstallButton } from "../../../hooks/useInstallButton";
import { PremiumModal } from "../../premium_modal/PremiumModal";
import { FileRequirement } from "../FileRequirement";

/** A download/enable card for one candidate (used by download + OR cards). */
export const CandidateCard = ({
  ctx,
  candidate,
  enabledFile,
  resolution,
  isOr,
}: {
  ctx: IFileActionContext;
  candidate: IFileRequirementCandidate;
  /** The wrong version this download replaces, if any; disabled once the download installs. */
  enabledFile?: IInstalledFile;
  resolution: IResolutionContext;
  isOr?: boolean;
}) => {
  const { t } = useTranslation(["health_check", "common"]);
  const [showPremium, setShowPremium] = useState(false);

  const { isLoading, onClick } = useInstallButton(() =>
    ctx.requestDownload(candidate, enabledFile),
  );

  const loading = isLoading || !!ctx.isDownloadingAll;

  const handleInstall = () => {
    ctx.onInstall(candidate, resolution);

    if (ctx.showPremiumAd) {
      setShowPremium(true);
      return;
    }

    onClick();
  };

  const handleModPage = () => {
    ctx.onOpenModPage(candidate, resolution);

    // Free users would still need to find and download the file themselves from the mod
    // page, so send them straight to it; premium users are just browsing.
    if (ctx.showPremiumAd) {
      openFilePage(ctx.api, candidate);
    } else {
      openModPage(ctx.api, candidate);
    }
  };

  return (
    <>
      <FileRequirement
        actions={
          <>
            <Button
              appearance="subdued"
              brand="neutral"
              leftIconPath={mdiOpenInNew}
              onClick={handleModPage}
            >
              {ctx.showPremiumAd
                ? t("detail::item::install_via_mod_page")
                : t("detail::item::view_mod_page")}
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

      <PremiumModal
        api={ctx.api}
        isOpen={showPremium}
        modCount={1}
        modId={decodeUID(candidate.modUID)?.id ?? 0}
        trigger="single_install"
        onClose={() => setShowPremium(false)}
        onDownload={() => {
          setShowPremium(false);
          openFilePage(ctx.api, candidate);
        }}
        onPremiumUnlocked={onClick}
      />
    </>
  );
};
