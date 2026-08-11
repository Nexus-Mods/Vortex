import { mdiCheck, mdiDiamondStone, mdiOpenInNew } from "@mdi/js";
import React, { type ReactNode, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Modal } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";
import { Campaign, Content, Section, nexusModsURL } from "@/util/util";

import { opn } from "../../../../util/api";
import { PREMIUM_PATH } from "../../../nexus_integration/constants";
import { isPremium } from "../../../nexus_integration/selectors";
import { useOptionalIssue, useTracker } from "../../hooks/HealthCheckTracking.context";
import { usePremiumStatusRefresh } from "../../hooks/usePremiumStatusRefresh";

/** Which 1-click flow surfaced the premium upsell modal. */
export type PremiumTrigger = "single_install" | "batch_install" | "install_all";

const ListItem = ({ children }: { children: ReactNode }) => (
  <li className="flex gap-x-1">
    <Icon className="mt-0.5 shrink-0 text-premium-strong" path={mdiCheck} size="xs" />

    {children}
  </li>
);

export const PremiumModal = ({
  api,
  isOpen,
  downloadScope = "single",
  modCount,
  modId,
  trigger,
  onClose,
  onDownload,
  onPremiumUnlocked,
}: {
  api: IExtensionApi;
  isOpen: boolean;
  downloadScope?: "single" | "all";
  modCount?: number;
  modId?: number;
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

  useEffect(() => {
    if (isOpen) {
      trackPremiumModalShown({ ...identity, trigger, mod_id: modId, mod_count: modCount });
    }
  }, [isOpen, trigger, identity, modId, modCount, trackPremiumModalShown]);

  // The purchase happens on the website, so watch for it while the upsell is up. This is
  // also why "Unlock premium" doesn't close the modal: staying open is what keeps the
  // check armed until the new membership can be seen.
  usePremiumStatusRefresh(api, isOpen);

  // Premium specifically, not `!shouldShowPremiumAd`: supporters can't download through
  // the client either, and an absent userInfo would read as a purchase that never happened.
  const unlocked = useSelector(isPremium);
  // Guards against re-running the action, not against re-rendering: onClose is the
  // parent's setState, so isOpen is still true for the rest of this effect's runs.
  const handledUnlockRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      handledUnlockRef.current = false;
      return;
    }

    if (!unlocked || handledUnlockRef.current) {
      return;
    }

    handledUnlockRef.current = true;
    onClose();
    onPremiumUnlocked?.();
  }, [isOpen, unlocked, onClose, onPremiumUnlocked]);

  return (
    <Modal
      isOpen={isOpen}
      title={t(`premium::modal::title::${downloadScope}`)}
      onClose={() => {
        trackPremiumModalDismissed({ ...identity, trigger });
        onClose();
      }}
    >
      <Typography appearance="subdued" as="div" className="space-y-2" typographyType="body-sm">
        <p className="whitespace-pre-line">{t(`premium::modal::description::${downloadScope}`)}</p>

        <p>{t("premium::modal::benefits_title")}</p>

        <ul className="space-y-2">
          <ListItem>{t("premium::modal::benefits::downloads")}</ListItem>

          <ListItem>{t("premium::modal::benefits::collections")}</ListItem>

          <ListItem>{t("premium::modal::benefits::speed")}</ListItem>

          <ListItem>{t("premium::modal::benefits::ad_free")}</ListItem>
        </ul>
      </Typography>

      <div className="mt-4 grid grid-cols-2 gap-x-2">
        <Button
          appearance="moderate"
          brand="neutral"
          className="w-full"
          leftIconPath={downloadScope === "single" && mdiOpenInNew}
          onClick={() => {
            trackPremiumModalFallbackClicked({
              ...identity,
              trigger,
              mod_count: modCount,
              fallback_type: downloadScope === "single" ? "single_mod_page" : "batch_mod_pages",
            });

            onDownload();
          }}
        >
          {t(`premium::modal::buttons::secondary::${downloadScope}`)}
        </Button>

        <Button
          brand="premium"
          className="w-full"
          leftIconPath={mdiDiamondStone}
          onClick={() => {
            trackPremiumModalUnlockClicked({
              ...identity,
              trigger,
              mod_count: modCount,
            });

            opn(
              nexusModsURL(PREMIUM_PATH, {
                section: Section.Users,
                campaign: Campaign.BuyPremium,
                content: Content.HealthCheckAd,
              }),
            ).catch(() => undefined);
          }}
        >
          {t("premium::modal::buttons::primary")}
        </Button>
      </div>
    </Modal>
  );
};
