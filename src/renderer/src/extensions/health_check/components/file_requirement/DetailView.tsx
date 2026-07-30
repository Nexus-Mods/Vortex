import React, { useEffect } from "react";
import { Trans } from "react-i18next";
import { useSelector } from "react-redux";

import {
  downloadFileRequirement,
  openModPage,
} from "@/extensions/health_check/utils/fileRequirements/fileRequirementActions";
import type { IFileRequirementReport } from "@/extensions/health_check/utils/fileRequirements/fileRequirementReport";
import { severityStyleMap } from "@/extensions/health_check/utils/shared/severityStyles";
import { decodeUID } from "@/extensions/nexus_integration/util/UIDs";
import type { IState } from "@/types/IState";
import { Icon } from "@/ui/components/icon/Icon";
import { Typography } from "@/ui/components/typography/Typography";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";
import { joinClasses } from "@/ui/utils/joinClasses";

import { shouldShowPremiumAd } from "../../../nexus_integration/selectors";
import { setFileRequirementHidden } from "../../actions/persistent";
import { useIssue, useIssueTracking } from "../../hooks/HealthCheckTracking.context";
import { useFileRequirementFeedback } from "../../hooks/useFileRequirementFeedback";
import { useReportCopy } from "../../hooks/useReportCopy";
import { isFileEntryHidden } from "../../views/content/fileRequirementEntries";
import type { IDetailViewProps } from "../../views/content/types";
import { EntryActions } from "../entry_actions/EntryActions";
import { RequirementBody } from "./RequirementBody";

export const DetailView = ({ entry, api, onBack }: IDetailViewProps) => {
  const report = entry.data as IFileRequirementReport;
  const severityStyle = severityStyleMap[entry.severity];
  const count = report.requirements.length;
  const { summary } = useReportCopy(report);

  const { identity, issueType, resolutionType } = useIssue();
  const {
    trackDetailViewed,
    trackOneClickInstallClicked,
    trackInstallAllInGroupClicked,
    trackInstallViaModPageClicked,
    trackViewModPageClicked,
    trackEnableClicked,
    trackEnableThisVersionClicked,
    trackViewInModsClicked,
    trackInstallDownloadedClicked,
    trackIssueHidden,
    trackIssueUnhidden,
  } = useIssueTracking();

  // detail_viewed fires once per detail open; entry-prop changes as the check re-runs
  // shouldn't re-fire it, so the mount-only effect is intentional.
  useEffect(() => {
    trackDetailViewed({
      issue_type: issueType,
      resolution_type: resolutionType,
      required_mod_count: report.requirements.length,
      source_mod_name: report.sourceModName,
    });
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, []);

  const isHidden = useSelector((state: IState) => isFileEntryHidden(state, entry));
  const toggleHideEntry = () => {
    if (isHidden) {
      trackIssueUnhidden({ issue_type: issueType });
    } else {
      trackIssueHidden({
        issue_type: issueType,
        resolution_type: resolutionType,
      });
    }

    for (const req of report.requirements) {
      api.store?.dispatch(
        setFileRequirementHidden(report.sourceFileUID, req.requirementDefId, !isHidden),
      );
    }

    onBack();
  };

  const showPremiumAd = useSelector(shouldShowPremiumAd);

  // Feedback is keyed per source file (see useFileRequirementFeedback); EntryActions
  // emits the analytics, this only records that feedback was given.
  const { givenFeedback, markFeedback } = useFileRequirementFeedback(api, report.sourceFileUID);

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
          {summary}
        </Typography>

        <div className="space-y-4">
          <RequirementBody
            api={api}
            ctx={{
              api,
              showPremiumAd,
              identity,
              requestDownload: (candidate) => downloadFileRequirement(api, candidate, identity),
              onInstall: (candidate, resolution) =>
                trackOneClickInstallClicked({
                  mod_id: decodeUID(candidate.modUID)?.id ?? 0,
                  mod_name: candidate.modName,
                  mod_version: candidate.version,
                  is_adult_content: candidate.adultContent,
                  requirement_state: resolution.requirementState,
                  option_count: resolution.optionCount,
                }),
              onInstallAll: (candidates, requirementState) =>
                trackInstallAllInGroupClicked({
                  mod_count: candidates.length,
                  requirement_state: requirementState,
                }),
              onOpenModPage: (candidate, resolution) => {
                const modPageProps = {
                  mod_id: decodeUID(candidate.modUID)?.id ?? 0,
                  mod_name: candidate.modName,
                  mod_version: candidate.version,
                };

                // Free users install via the website (a resolution action); premium users
                // browsing to the mod page is informational, so it carries no resolution.
                if (showPremiumAd) {
                  trackInstallViaModPageClicked({
                    ...modPageProps,
                    requirement_state: resolution.requirementState,
                    option_count: resolution.optionCount,
                  });
                } else {
                  trackViewModPageClicked(modPageProps);
                }
              },
              onEnable: (correctFile, enabledFile, resolution) => {
                const resolutionProps = {
                  requirement_state: resolution.requirementState,
                  option_count: resolution.optionCount,
                };

                if (enabledFile) {
                  trackEnableThisVersionClicked({
                    ...resolutionProps,
                    mod_id: decodeUID(correctFile.modUID)?.id ?? 0,
                    required_version: correctFile.version,
                    current_version: enabledFile.version,
                  });
                } else {
                  trackEnableClicked({
                    ...resolutionProps,
                    mod_id: decodeUID(correctFile.modUID)?.id ?? 0,
                    mod_name: correctFile.modName,
                    mod_version: correctFile.version,
                  });
                }
              },
              onViewInMods: (file) =>
                trackViewInModsClicked({
                  mod_id: decodeUID(file.modUID)?.id ?? 0,
                  mod_name: file.modName,
                }),
              onInstallDownloaded: (file, resolution) =>
                trackInstallDownloadedClicked({
                  mod_id: decodeUID(file.modUID)?.id ?? 0,
                  requirement_state: resolution.requirementState,
                  option_count: resolution.optionCount,
                }),
            }}
            report={report}
          />
        </div>
      </div>
    </div>
  );
};
