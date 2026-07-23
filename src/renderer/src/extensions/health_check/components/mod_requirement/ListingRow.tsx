import { mdiMonitorArrowDownVariant } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";

import { useModRequirementActions } from "../../hooks/useModRequirementActions";
import type { IModRequirementExt } from "../../types";
import type { IListingRowProps } from "../../views/content/types";
import { EntryActions } from "../entry_actions/EntryActions";
import { ListingRow as ListingRowShell } from "../listing_row/ListingRow";
import { PremiumModal } from "../premium_modal/PremiumModal";

export const ListingRow = ({ api, entry, isHidden, onOpen, onToggleHide }: IListingRowProps) => {
  const { t } = useTranslation(["health_check", "common"]);
  const mod = entry.data as IModRequirementExt;

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
      <ListingRowShell
        action={
          mod.externalRequirement ? (
            <Button
              appearance="moderate"
              brand="neutral"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
            >
              {t("listing::external_mod_install")}
            </Button>
          ) : (
            <Button
              appearance="moderate"
              brand="neutral"
              leftIconPath={mdiMonitorArrowDownVariant}
              rightIcon={showPremiumAd ? <PremiumBadge /> : undefined}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                void installInApp();
              }}
            >
              {t("detail::item::install_one_click")}
            </Button>
          )
        }
        detail={t("listing::item::description", {
          dependencyModName: mod.modName || mod.modUrl || mod.notes,
        })}
        entryActions={
          <EntryActions
            givenFeedback={givenFeedback}
            isHidden={isHidden}
            variant="listing"
            onHelpful={handlePositiveFeedback}
            onNotHelpful={handleFeedbackSuccess}
            onToggleHide={onToggleHide}
          />
        }
        severity={entry.severity}
        summary={
          mod.notes
            ? t("detail::item::author_note", { note: mod.notes })
            : t("detail::item::may_require_file")
        }
        title={t("listing::item::title", { modName: mod.requiredBy.modName })}
        onOpen={onOpen}
      />

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
