import React from "react";
import { Trans, useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import {
  downloadFileRequirement,
  openModPage,
} from "@/extensions/health_check/utils/fileRequirements/fileRequirementActions";
import type { IFileRequirementReport } from "@/extensions/health_check/utils/fileRequirements/fileRequirementReport";
import type { IFileRequirementCandidate } from "@/extensions/health_check/utils/fileRequirements/mapRequirementsReport";
import { severityStyleMap } from "@/extensions/health_check/utils/shared/severityStyles";
import type { IState } from "@/types/IState";
import { Icon } from "@/ui/components/icon/Icon";
import { Typography } from "@/ui/components/typography/Typography";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";
import { joinClasses } from "@/ui/utils/joinClasses";

import { shouldShowPremiumAd } from "../../../nexus_integration/selectors";
import { setFileRequirementHidden } from "../../actions/persistent";
import { useFileRequirementFeedback } from "../../hooks/useFileRequirementFeedback";
import { isFileEntryHidden } from "../../views/content/fileRequirementEntries";
import type { IDetailViewProps } from "../../views/content/types";
import { EntryActions } from "../entry_actions/EntryActions";
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

  // Feedback is keyed per source file (see useFileRequirementFeedback). NOTE:
  // file-level feedback is persisted only, it does not emit a Mixpanel event yet
  // (HealthCheckFeedbackEvent is mod-shaped).
  const { givenFeedback, markFeedback } = useFileRequirementFeedback(api, report.sourceFileUID);

  // Report-level intro line, mirroring the per-category detail copy.
  const subtitle =
    report.category === "toggle"
      ? t("detail::item::wrong_version_enabled")
      : report.category === "download-replace"
        ? t("detail::item::wrong_version_installed")
        : report.category === "install-uninstalled"
          ? t("detail::item::correct_version_downloaded")
          : t(count > 1 ? "shared::requires_files_plural" : "shared::requires_files", {
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

        <EntryActions
          givenFeedback={givenFeedback}
          isHidden={isHidden}
          severity={entry.severity}
          variant="detail"
          onHelpful={markFeedback}
          onNotHelpful={markFeedback}
          onToggleHide={toggleHideEntry}
        />
      </div>

      <div className="pt-4 pb-6">
        <Typography appearance="subdued" className="mb-4 px-6">
          {subtitle}
        </Typography>

        <div className="space-y-4">
          <RequirementBody
            api={api}
            ctx={{
              api,
              showPremiumAd,
              requestDownload: (candidate) => downloadFileRequirement(api, candidate),
            }}
            report={report}
          />
        </div>
      </div>
    </div>
  );
};
