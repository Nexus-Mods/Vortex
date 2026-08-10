import { mdiEyeOutline, mdiEyeOffOutline, mdiThumbDownOutline, mdiThumbUpOutline } from "@mdi/js";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Severity } from "@/extensions/health_check/utils/shared/severityStyles";
import { Button } from "@/ui/components/button/Button";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { TooltipDelayGroup } from "@/ui/components/tooltip/TooltipDelayGroup";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

import { useIssue, useIssueTracking } from "../../hooks/HealthCheckTracking.context";
import { FeedbackModal } from "../feedback_modal/FeedbackModal";

interface IEntryActionsProps {
  variant: "listing" | "detail";
  givenFeedback: boolean;
  isHidden?: boolean;
  severity?: Severity;
  onHelpful: () => void;
  onNotHelpful: (reasons: string[]) => void;
  onToggleHide: () => void;
}

export function EntryActions({
  variant,
  givenFeedback,
  isHidden,
  severity,
  onHelpful,
  onNotHelpful,
  onToggleHide,
}: IEntryActionsProps) {
  const { t } = useTranslation(["health_check", "common"]);
  const { issueType, resolutionType } = useIssue();
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const { trackFeedbackHelpful, trackFeedbackNotHelpful, trackFeedbackDismissed } =
    useIssueTracking();

  const appearance = variant === "listing" ? "weak" : "subdued";

  const handle = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      className={joinClasses([
        "flex shrink-0 items-center",
        variant === "listing"
          ? "invisible gap-x-1 group-focus-within:visible group-hover:visible"
          : "gap-x-2",
      ])}
      onClick={(e) => e.stopPropagation()}
    >
      {variant === "detail" && !!severity && (
        <Typography appearance="subdued" typographyType="body-sm">
          {givenFeedback
            ? t("common:::thanks_for_your_feedback")
            : t(`detail::was_this_helpful::${severity}`)}
        </Typography>
      )}

      <TooltipDelayGroup>
        <Tooltip content={t("common:::helpful")} placement="bottom">
          <Button
            appearance={appearance}
            aria-label={t("common:::helpful")}
            brand="neutral"
            data-testid="health-check-feedback-helpful"
            disabled={givenFeedback}
            leftIconPath={mdiThumbUpOutline}
            size="sm"
            onClick={handle(() => {
              trackFeedbackHelpful({ issue_type: issueType, resolution_type: resolutionType });
              onHelpful();
            })}
          />
        </Tooltip>

        <Tooltip content={t("common:::not_helpful")} placement="bottom">
          <Button
            appearance={appearance}
            aria-label={t("common:::not_helpful")}
            brand="neutral"
            data-testid="health-check-feedback-not-helpful"
            disabled={givenFeedback}
            leftIconPath={mdiThumbDownOutline}
            size="sm"
            onClick={handle(() => setShowFeedbackModal(true))}
          />
        </Tooltip>

        {variant === "detail" && <div className="w-px self-stretch bg-stroke-weak" />}

        <Tooltip content={isHidden ? t("common:::unhide") : t("common:::hide")} placement="bottom">
          <Button
            appearance={appearance}
            aria-label={isHidden ? t("common:::unhide") : t("common:::hide")}
            brand="neutral"
            data-testid="health-check-entry-hide"
            leftIconPath={isHidden ? mdiEyeOutline : mdiEyeOffOutline}
            size="sm"
            onClick={handle(onToggleHide)}
          />
        </Tooltip>
      </TooltipDelayGroup>

      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => {
          trackFeedbackDismissed({ issue_type: issueType });
          setShowFeedbackModal(false);
        }}
        onSuccess={(reasons) => {
          trackFeedbackNotHelpful({
            issue_type: issueType,
            resolution_type: resolutionType,
            feedback_reasons: reasons,
          });
          onNotHelpful(reasons);
          setShowFeedbackModal(false);
        }}
      />
    </div>
  );
}
