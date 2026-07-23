import { mdiCallSplit, mdiCheck, mdiSwapHorizontal, mdiTrayArrowDown } from "@mdi/js";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import {
  downloadFileRequirement,
  installDownloadedFile,
  openModPage,
  switchActiveVersions,
} from "@/extensions/health_check/utils/fileRequirements/fileRequirementActions";
import {
  canQuickInstall,
  downloadCandidates,
  requirementModName,
  switchTargets,
  uninstalledFiles,
} from "@/extensions/health_check/utils/fileRequirements/fileRequirementReport";
import type { IFileRequirementReport } from "@/extensions/health_check/utils/fileRequirements/fileRequirementReport";
import { Button } from "@/ui/components/button/Button";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";

import { shouldShowPremiumAd } from "../../../nexus_integration/selectors";
import { useFileRequirementFeedback } from "../../hooks/useFileRequirementFeedback";
import { useReportCopy } from "../../hooks/useReportCopy";
import type { IListingRowProps } from "../../views/content/types";
import { EntryActions } from "../entry_actions/EntryActions";
import { ListingRow as ListingRowShell } from "../listing_row/ListingRow";
import { PremiumModal } from "../premium_modal/PremiumModal";

export const ListingRow = ({ api, entry, isHidden, onOpen, onToggleHide }: IListingRowProps) => {
  const { t } = useTranslation(["health_check", "common"]);
  const report = entry.data as IFileRequirementReport;
  const { title, summary } = useReportCopy(report);

  const showPremiumAd = useSelector(shouldShowPremiumAd);
  const [showPremium, setShowPremium] = useState(false);
  const { givenFeedback, markFeedback } = useFileRequirementFeedback(api, report.sourceFileUID);

  const candidates = downloadCandidates(report.requirements);
  const quickInstall = canQuickInstall(report.category) && !!candidates.length;
  const switches = switchTargets(report.requirements);
  const toInstall = uninstalledFiles(report.requirements);
  const orJoin = ` ${t("listing::item::or_join")} `;

  const names = report.requirements
    .map((requirement) => requirementModName(requirement, orJoin))
    .filter(Boolean);
  const namesLine =
    names.length > 1
      ? `${names[0]} ${t("listing::item::more_count", { count: names.length - 1 })}`
      : names[0];

  const doQuickInstall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showPremiumAd) {
      setShowPremium(true);
      return;
    }
    candidates.forEach((candidate) => void downloadFileRequirement(api, candidate));
  };

  return (
    <>
      <ListingRowShell
        action={
          quickInstall ? (
            <Button
              appearance="moderate"
              brand="neutral"
              leftIconPath={mdiTrayArrowDown}
              rightIcon={showPremiumAd ? <PremiumBadge /> : undefined}
              size="sm"
              onClick={doQuickInstall}
            >
              {candidates.length === 1
                ? t("detail::item::install_one_click")
                : t("listing::install_one_click", { count: candidates.length })}
            </Button>
          ) : report.category === "or" ? (
            <Button
              appearance="moderate"
              brand="neutral"
              leftIconPath={mdiCallSplit}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
            >
              {t("listing::pick_mod_install")}
            </Button>
          ) : report.category === "toggle" && !!switches.length ? (
            <Button
              appearance="moderate"
              brand="neutral"
              leftIconPath={mdiSwapHorizontal}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                switchActiveVersions(api, switches);
              }}
            >
              {t("detail::item::enable_this_version")}
            </Button>
          ) : (
            report.category === "install-uninstalled" &&
            !!toInstall.length && (
              <Button
                appearance="moderate"
                brand="neutral"
                leftIconPath={mdiCheck}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  toInstall.forEach((req) => void installDownloadedFile(api, req.uninstalledFile));
                }}
              >
                {t("listing::install_uninstalled")}
              </Button>
            )
          )
        }
        detail={namesLine}
        entryActions={
          <EntryActions
            givenFeedback={givenFeedback}
            isHidden={isHidden}
            variant="listing"
            onHelpful={markFeedback}
            onNotHelpful={markFeedback}
            onToggleHide={onToggleHide}
          />
        }
        severity={entry.severity}
        summary={summary}
        title={title}
        onOpen={onOpen}
      />

      <PremiumModal
        downloadScope={candidates.length === 1 ? "single" : "all"}
        isOpen={showPremium}
        onClose={() => setShowPremium(false)}
        onDownload={() => {
          setShowPremium(false);
          // Free-user fallback: a single candidate opens its mod page; otherwise
          // open the detail so each requirement's mod page is reachable.
          if (candidates.length === 1) {
            openModPage(api, candidates[0]);
          } else {
            onOpen();
          }
        }}
      />
    </>
  );
};
