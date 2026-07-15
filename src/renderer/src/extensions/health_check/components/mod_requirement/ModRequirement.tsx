import { mdiChevronRight, mdiDownload } from "@mdi/js";
import React, { type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

import {
  severityStyleMap,
  type Severity,
} from "@/extensions/health_check/utils/shared/severityStyles";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

import type { IModRequirementExt } from "../../types";
import { EntryActions } from "../entry_actions/EntryActions";
import { FeedbackModal } from "../feedback_modal/FeedbackModal";
import { PremiumModal } from "../premium_modal/PremiumModal";
import { useModRequirementActions } from "./useModRequirementActions";

interface IModRequirementProps {
  api: IExtensionApi;
  isHidden?: boolean;
  severity: Severity;
  requirementInfo: IModRequirementExt;
  onClick: () => void;
  onToggleHide?: () => void;
}

export const ModRequirement = ({
  api,
  isHidden,
  severity,
  onClick,
  onToggleHide,
  requirementInfo,
}: IModRequirementProps) => {
  const { t } = useTranslation(["health_check", "common"]);
  const severityStyle = severityStyleMap[severity];

  const {
    givenFeedback,
    showPremiumAd,
    showFeedbackModal,
    setShowFeedbackModal,
    showPremiumModal,
    setShowPremiumModal,
    openModPage,
    installInApp,
    handlePositiveFeedback,
    handleFeedbackSuccess,
  } = useModRequirementActions(api, requirementInfo);

  return (
    <>
      <div
        className="group hover-overlay-weak flex w-full cursor-pointer items-center gap-x-4 rounded-sm bg-surface-mid px-4 py-3 shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info-subdued"
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e: KeyboardEvent) => {
          if (["Enter", " "].includes(e.key)) {
            e.preventDefault();
            onClick();
          }
        }}
      >
        <Icon
          className={joinClasses(["shrink-0", severityStyle.textClassName])}
          path={severityStyle.iconPath}
        />

        <div className="min-w-0 grow text-left">
          <div className="flex items-start justify-between gap-x-4">
            <div className="min-w-0">
              <Typography className="truncate">
                {t("listing::item::title", { modName: requirementInfo.requiredBy.modName })}
              </Typography>

              <Typography appearance="subdued" className="truncate" typographyType="body-sm">
                {t("listing::item::description", {
                  dependencyModName:
                    requirementInfo.modName || requirementInfo.modUrl || requirementInfo.notes,
                })}
              </Typography>
            </div>

            <EntryActions
              givenFeedback={givenFeedback}
              isHidden={isHidden}
              variant="listing"
              onHelpful={handlePositiveFeedback}
              onNotHelpful={() => setShowFeedbackModal(true)}
              onToggleHide={() => onToggleHide?.()}
            />
          </div>
        </div>

        <Button
          appearance="moderate"
          brand="neutral"
          className="shrink-0 self-center"
          leftIconPath={mdiDownload}
          rightIcon={showPremiumAd ? <PremiumBadge /> : undefined}
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            void installInApp();
          }}
        >
          {t("detail::item::install_one_click")}
        </Button>

        <Icon className="shrink-0 text-translucent-moderate" path={mdiChevronRight} size="lg" />
      </div>

      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        onDownload={() => {
          setShowPremiumModal(false);
          openModPage();
        }}
      />

      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onSuccess={handleFeedbackSuccess}
      />
    </>
  );
};
