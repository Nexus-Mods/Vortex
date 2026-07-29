import { mdiMonitorArrowDownVariant } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";

import { useIssue, useIssueTracking } from "../../hooks/HealthCheckTracking.context";
import { useModRequirementActions } from "../../hooks/useModRequirementActions";
import type { IModRequirementExt } from "../../types";
import type { IListingRowProps } from "../../views/content/types";
import { EntryActions } from "../entry_actions/EntryActions";
import { ListingRow as ListingRowShell } from "../listing_row/ListingRow";
import { PremiumModal } from "../premium_modal/PremiumModal";

export const ListingRow = ({ api, entry, isHidden, onOpen, onToggleHide }: IListingRowProps) => {
  const { t } = useTranslation(["health_check", "common"]);
  const mod = entry.data as IModRequirementExt;

  const { identity, issueType, resolutionType } = useIssue();

  const {
    givenFeedback,
    showPremiumAd,
    showPremiumModal,
    setShowPremiumModal,
    openModPage,
    installInApp,
    markFeedback,
  } = useModRequirementActions(api, mod, identity);

  const { trackOneClickInstallClicked, trackIssueHidden, trackIssueUnhidden } = useIssueTracking();

  const handleInstall = () => {
    trackOneClickInstallClicked({
      mod_id: mod.modId,
      mod_name: mod.modName,
      mod_version: mod.mainFile?.version ?? "",
      is_adult_content: mod.mainFile?.adultContent ?? false,
    });

    void installInApp();
  };

  const handleToggleHide = () => {
    if (isHidden) {
      trackIssueUnhidden({ issue_type: issueType });
    } else {
      trackIssueHidden({
        issue_type: issueType,
        resolution_type: resolutionType,
      });
    }

    onToggleHide();
  };

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
                handleInstall();
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
            onHelpful={markFeedback}
            onNotHelpful={markFeedback}
            onToggleHide={handleToggleHide}
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
        modCount={1}
        modId={mod.modId}
        trigger="single_install"
        onClose={() => setShowPremiumModal(false)}
        onDownload={() => {
          setShowPremiumModal(false);
          openModPage();
        }}
      />
    </>
  );
};
