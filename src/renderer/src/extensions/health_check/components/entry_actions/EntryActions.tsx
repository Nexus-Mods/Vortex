import type { TFunction } from "i18next";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Severity } from "@/extensions/health_check/utils/shared/severityStyles";
import { Button } from "@/ui/components/button/Button";
import { FeedbackModal } from "@/ui/components/feedback_modal/FeedbackModal";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { TooltipDelayGroup } from "@/ui/components/tooltip/TooltipDelayGroup";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

import { useIssue, useIssueTracking } from "../../hooks/HealthCheckTracking.context";

/** The not-helpful reasons, each key with its label's static key for extraction. */
const feedbackReasons = (t: TFunction) => [
  {
    key: "incorrect_requirement",
    label: t("detail::feedback_modal::options::incorrect_requirement"),
  },
  {
    key: "requirement_already_installed",
    label: t("detail::feedback_modal::options::requirement_already_installed"),
  },
  {
    key: "explanation_was_unclear",
    label: t("detail::feedback_modal::options::explanation_was_unclear"),
  },
  { key: "other", label: t("detail::feedback_modal::options::other") },
];

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

  const dismissFeedback = () => {
    trackFeedbackDismissed({ issue_type: issueType });
    setShowFeedbackModal(false);
  };

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
            leftIcon="thumb_up"
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
            leftIcon="thumb_down"
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
            leftIcon={isHidden ? "visibility" : "visibility_off"}
            onClick={handle(onToggleHide)}
          />
        </Tooltip>
      </TooltipDelayGroup>

      <FeedbackModal
        isOpen={showFeedbackModal}
        negative={{
          title: t("detail::feedback_modal::title"),
          body: t("detail::feedback_modal::description"),
          reasons: feedbackReasons(t),
        }}
        preselectedSentiment="negative"
        sendLabel={t("detail::feedback_modal::buttons::confirm")}
        skipLabel={t("detail::feedback_modal::buttons::cancel")}
        onDismiss={dismissFeedback}
        onSend={({ reasons }) => {
          trackFeedbackNotHelpful({
            issue_type: issueType,
            resolution_type: resolutionType,
            feedback_reasons: reasons,
          });
          onNotHelpful(reasons);
          setShowFeedbackModal(false);
        }}
        onSkip={dismissFeedback}
      />
    </div>
  );
}
