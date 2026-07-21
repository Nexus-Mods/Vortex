import { mdiEye, mdiEyeOff, mdiThumbDownOutline, mdiThumbUpOutline } from "@mdi/js";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Severity } from "@/extensions/health_check/utils/shared/severityStyles";
import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

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
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
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

      <Button
        appearance={appearance}
        brand="neutral"
        disabled={givenFeedback}
        leftIconPath={mdiThumbUpOutline}
        size="sm"
        title={t("common:::helpful")}
        onClick={handle(onHelpful)}
      />

      <Button
        appearance={appearance}
        brand="neutral"
        disabled={givenFeedback}
        leftIconPath={mdiThumbDownOutline}
        size="sm"
        title={t("common:::not_helpful")}
        onClick={handle(() => setShowFeedbackModal(true))}
      />

      {variant === "detail" && <div className="w-px self-stretch bg-stroke-weak" />}

      <Button
        appearance={appearance}
        brand="neutral"
        leftIconPath={isHidden ? mdiEye : mdiEyeOff}
        size="sm"
        title={isHidden ? t("common:::unhide") : t("common:::hide")}
        onClick={handle(onToggleHide)}
      />

      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onSuccess={(reasons) => {
          onNotHelpful(reasons);
          setShowFeedbackModal(false);
        }}
      />
    </div>
  );
}
