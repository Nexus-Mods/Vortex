import React from "react";
import { useTranslation } from "react-i18next";

import {
  useOptionalIssue,
  useTracker,
} from "@/extensions/health_check/hooks/HealthCheckTracking.context";
import { PremiumUpsellModal } from "@/extensions/nexus_integration/components/premium_upsell_modal/PremiumUpsellModal";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { Content } from "@/util/util";

/** Which 1-click flow surfaced the premium upsell modal. */
export type PremiumTrigger = "single_install" | "batch_install" | "install_all";

/** Health Check's Premium upsell, worded for installing one requirement or many, and counted. */
export const PremiumModal = ({
  api,
  isOpen,
  downloadScope = "single",
  modCount,
  modUID,
  trigger,
  onClose,
  onDownload,
  onPremiumUnlocked,
}: {
  api: IExtensionApi;
  isOpen: boolean;
  downloadScope?: "single" | "all";
  modCount?: number;
  modUID?: string;
  /** Which 1-click flow surfaced the upsell, for the analytics funnel. */
  trigger: PremiumTrigger;
  onClose: () => void;
  onDownload: () => void;
  /**
   * Run the gated action once the purchase lands, so the user gets what they came for
   * instead of having to find the button again. The modal closes either way.
   */
  onPremiumUnlocked?: () => void;
}) => {
  const { t } = useTranslation(["health_check"]);

  const {
    trackPremiumModalShown,
    trackPremiumModalDismissed,
    trackPremiumModalUnlockClicked,
    trackPremiumModalFallbackClicked,
  } = useTracker();
  // Absent for the cross-check install-all upsell raised from the listing.
  const identity = useOptionalIssue()?.identity;

  return (
    <PremiumUpsellModal
      api={api}
      content={Content.HealthCheckAd}
      description={t(`premium::modal::description::${downloadScope}`)}
      fallbackIcon={downloadScope === "single" ? "open_in_new" : undefined}
      fallbackLabel={t(`premium::modal::buttons::secondary::${downloadScope}`)}
      isOpen={isOpen}
      title={t(`premium::modal::title::${downloadScope}`)}
      onClose={onClose}
      onDismissed={() => trackPremiumModalDismissed({ ...identity, trigger })}
      onFallback={() => {
        trackPremiumModalFallbackClicked({
          ...identity,
          trigger,
          mod_count: modCount,
          fallback_type: downloadScope === "single" ? "single_mod_page" : "batch_mod_pages",
        });

        onDownload();
      }}
      onPremiumUnlocked={onPremiumUnlocked}
      onShown={() =>
        trackPremiumModalShown({ ...identity, trigger, mod_uid: modUID, mod_count: modCount })
      }
      onUnlockClicked={() =>
        trackPremiumModalUnlockClicked({ ...identity, trigger, mod_count: modCount })
      }
    />
  );
};
