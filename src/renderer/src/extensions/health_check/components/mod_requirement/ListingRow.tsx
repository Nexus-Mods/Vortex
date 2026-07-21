import { mdiChevronRight, mdiDownload } from "@mdi/js";
import React, { type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

import { severityStyleMap } from "@/extensions/health_check/utils/shared/severityStyles";
import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

import { useModRequirementActions } from "../../hooks/useModRequirementActions";
import type { IModRequirementExt } from "../../types";
import type { IListingRowProps } from "../../views/content/types";
import { EntryActions } from "../entry_actions/EntryActions";
import { PremiumModal } from "../premium_modal/PremiumModal";

export const ListingRow = ({ api, entry, isHidden, onOpen, onToggleHide }: IListingRowProps) => {
  const { t } = useTranslation(["health_check", "common"]);
  const mod = entry.data as IModRequirementExt;
  const severityStyle = severityStyleMap[entry.severity];

  const {
    givenFeedback,
    showPremiumAd,
    showPremiumModal,
    setShowPremiumModal,
    openModPage,
    installInApp,
    handlePositiveFeedback,
    handleFeedbackSuccess,
  } = useModRequirementActions(api, mod);

  return (
    <>
      <div
        className="group hover-overlay-weak flex w-full cursor-pointer items-center gap-x-4 rounded-sm bg-surface-mid px-4 py-3 shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info-subdued"
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e: KeyboardEvent) => {
          if (["Enter", " "].includes(e.key)) {
            e.preventDefault();
            onOpen();
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
                {t("listing::item::title", { modName: mod.requiredBy.modName })}
              </Typography>

              <Typography appearance="subdued" className="truncate" typographyType="body-sm">
                {t("listing::item::description", {
                  dependencyModName: mod.modName || mod.modUrl || mod.notes,
                })}
              </Typography>
            </div>

            <EntryActions
              givenFeedback={givenFeedback}
              isHidden={isHidden}
              variant="listing"
              onHelpful={handlePositiveFeedback}
              onNotHelpful={handleFeedbackSuccess}
              onToggleHide={onToggleHide}
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
    </>
  );
};
