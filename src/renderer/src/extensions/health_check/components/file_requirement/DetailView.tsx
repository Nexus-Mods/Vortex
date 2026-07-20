import { mdiTrayArrowDown } from "@mdi/js";
import React, { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IFileActionContext } from "@/extensions/health_check/utils/fileRequirements/cardHelpers";
import {
  downloadFileRequirement,
  openModPage,
} from "@/extensions/health_check/utils/fileRequirements/fileRequirementActions";
import {
  canQuickInstall,
  downloadCandidates,
  groupJoin,
  groupTitleKey,
} from "@/extensions/health_check/utils/fileRequirements/fileRequirementReport";
import type { IFileRequirementReport } from "@/extensions/health_check/utils/fileRequirements/fileRequirementReport";
import type { IFileRequirementCandidate } from "@/extensions/health_check/utils/fileRequirements/mapRequirementsReport";
import { severityStyleMap } from "@/extensions/health_check/utils/shared/severityStyles";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";
import { Typography } from "@/ui/components/typography/Typography";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";
import { joinClasses } from "@/ui/utils/joinClasses";

import { shouldShowPremiumAd } from "../../../nexus_integration/selectors";
import { setFileRequirementHidden } from "../../actions/persistent";
import { useFileRequirementFeedback } from "../../hooks/useFileRequirementFeedback";
import { isFileEntryHidden } from "../../views/content/fileRequirementEntries";
import type { IDetailViewProps } from "../../views/content/types";
import { EntryActions } from "../entry_actions/EntryActions";
import { PremiumModal } from "../premium_modal/PremiumModal";
import { RequirementBody } from "./RequirementBody";

export const DetailView = ({ entry, api, onBack }: IDetailViewProps) => {
  const { t } = useTranslation(["health_check", "common"]);
  const report = entry.data as IFileRequirementReport;
  const severityStyle = severityStyleMap[entry.severity];
  const count = report.requirements.length;

  const isHidden = useSelector((state: IState) => isFileEntryHidden(state, entry));
  const toggleHideEntry = () => {
    for (const req of report.requirements) {
      api.store?.dispatch(
        setFileRequirementHidden(report.sourceFileUID, req.requirementDefId, !isHidden),
      );
    }
    onBack();
  };

  const showPremiumAd = useSelector(shouldShowPremiumAd);
  // null = closed; otherwise the scope that triggered the upsell (single keeps the
  // candidate so its mod page can be opened on the free fallback action).
  const [premiumRequest, setPremiumRequest] = useState<
    { scope: "single"; candidate: IFileRequirementCandidate } | { scope: "all" } | null
  >(null);

  // Feedback is keyed per source file (see useFileRequirementFeedback). NOTE:
  // file-level feedback is persisted only, it does not emit a Mixpanel event yet
  // (HealthCheckFeedbackEvent is mod-shaped).
  const { givenFeedback, markFeedback } = useFileRequirementFeedback(api, report.sourceFileUID);

  const requestDownload = (candidate: IFileRequirementCandidate) => {
    // downloadFileRequirement routes free users to the file page (open-the-website
    // fallback) and premium users to the real 1-click download.
    void downloadFileRequirement(api, candidate);
  };

  const ctx: IFileActionContext = { api, showPremiumAd, requestDownload };

  const installAllCandidates = canQuickInstall(report.category)
    ? downloadCandidates(report.requirements)
    : [];

  const installAll = () => {
    if (showPremiumAd) {
      setPremiumRequest({ scope: "all" });
      return;
    }
    installAllCandidates.forEach((candidate) => void downloadFileRequirement(api, candidate));
  };

  // Report-level intro line, mirroring the per-category detail copy.
  const subtitle =
    report.category === "toggle"
      ? t("detail::item::wrong_version_enabled")
      : report.category === "download-replace"
        ? t("detail::item::wrong_version_installed")
        : report.category === "install-uninstalled"
          ? t("detail::item::correct_version_downloaded")
          : t(count > 1 ? "detail::item::requires_files_plural" : "detail::item::requires_files", {
              count,
            });

  return (
    <div className="rounded-lg border border-stroke-weak">
      <div className="flex items-center justify-between gap-x-4 border-b border-stroke-weak p-3">
        <div className="flex min-w-0 items-center gap-x-2">
          <Icon
            className={joinClasses(["shrink-0", severityStyle.textClassName])}
            path={severityStyle.iconPath}
          />

          <Typography as="div" className="font-semibold">
            <Trans
              components={{
                modLink: (
                  <TypographyLink
                    typographyType="inherit"
                    variant="secondary"
                    onClick={() =>
                      openModPage(api, {
                        fileUID: report.sourceFileUID,
                        modUID: report.sourceModUID,
                      })
                    }
                  />
                ),
              }}
              count={count}
              i18nKey="detail::item::missing_for"
              ns="health_check"
              values={{ modName: report.sourceModName }}
            />
          </Typography>
        </div>

        <div className="flex shrink-0 items-center gap-x-2">
          <EntryActions
            givenFeedback={givenFeedback}
            isHidden={isHidden}
            severity={entry.severity}
            variant="detail"
            onHelpful={markFeedback}
            onNotHelpful={markFeedback}
            onToggleHide={toggleHideEntry}
          />

          {installAllCandidates.length > 1 && (
            <Button
              appearance="moderate"
              brand="neutral"
              leftIconPath={mdiTrayArrowDown}
              rightIcon={showPremiumAd ? <PremiumBadge /> : undefined}
              size="sm"
              onClick={installAll}
            >
              {t("actions::install_all", { count: installAllCandidates.length })}
            </Button>
          )}
        </div>
      </div>

      <div className="pt-4 pb-6">
        <Typography appearance="subdued" className="mb-4 px-6">
          {subtitle}
        </Typography>

        <div className="space-y-4">
          <RequirementBody
            api={api}
            ctx={ctx}
            join={groupJoin(report.category)}
            requirements={report.requirements}
            title={t(groupTitleKey(report.category))}
          />
        </div>

        <PremiumModal
          downloadScope={premiumRequest?.scope ?? "single"}
          isOpen={premiumRequest !== null}
          onClose={() => setPremiumRequest(null)}
          onDownload={() => {
            // Free-user fallback: for a single candidate, open its mod page.
            if (premiumRequest?.scope === "single") {
              openModPage(api, premiumRequest.candidate);
            }
            setPremiumRequest(null);
          }}
        />
      </div>
    </div>
  );
};
